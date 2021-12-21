import { decodeAddress, encodeAddress, getApplicationAddress, isValidAddress, modelsv2 } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Runtime } from "../index";
import { checkIndexBound, compareArray } from "../lib/compare";
import { ALGORAND_MAX_APP_ARGS_LEN, ALGORAND_MAX_TX_ACCOUNTS_LEN, ALGORAND_MAX_TX_ARRAY_LEN, DEFAULT_STACK_ELEM, MaxAppProgramCost, MaxTEALVersion } from "../lib/constants";
import { keyToBytes } from "../lib/parsing";
import { Stack } from "../lib/stack";
import { assertMaxCost, parser } from "../parser/parser";
import {
  AccountStoreI, EncTx, ExecutionMode, Operator, SSCAttributesM,
  StackElem, TEALStack, TxReceipt
} from "../types";
import { Op } from "./opcode";
import { Label } from "./opcode-list";

/**
 * Interpreter parses and executes a TEAL code. Each transaction is using a new instance of
 * interpreter and doesn't share the interpreter state. When executing the transaction
 * we create a Context (`ctx`) and pass it to the interpreter. It encapsulates
 * runtime state and the transaction group state (eg shared scratch space).
 * Interpreter must not modify the `runtime` - the latter will be updated during the context
 * commit phase once all transactions in the groups succeed.
 */
export class Interpreter {
  readonly stack: TEALStack;
  tealVersion: number; // LogicSigVersion
  lineToCost: { [key: number]: number }; // { <lineNo>: <OpCost> } cost of each instruction by line
  gas: number; // total gas cost of TEAL code
  length: number; // total length of 'compiled' TEAL code
  // local stores for a transaction.
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  // TEAL parsed code - instantiated during the execution phase.
  instructions: Operator[];
  instructionIndex: number;
  runtime: Runtime;
  // The call stack is separate from the data stack. Only callsub and retsub manipulate it.
  // It is used to provide sub routine functionality
  callStack: Stack<number>;
  labelMap: Map<string, number>; // label string mapped to their respective indexes in instructions array
  subTxn: EncTx | undefined; // "current" inner transaction
  innerTxns: EncTx[]; // executed inner transactions

  constructor () {
    this.stack = new Stack<StackElem>();
    this.tealVersion = 1; // LogicSigVersion = 1 by default (if not specified by pragma)
    // total cost computed during code parsing, used in TEAL <= v3
    this.gas = 0;
    // gas cost of each line used in TEAL >=4 (we accumulate gas when executing the code).
    this.lineToCost = {};
    this.length = 0; // code length
    this.bytecblock = [];
    this.intcblock = [];
    // scratch spece used
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.instructions = [];
    this.instructionIndex = 0; // set instruction index to zero
    this.runtime = <Runtime>{};
    this.callStack = new Stack<number>();
    this.labelMap = new Map<string, number>();
    this.subTxn = undefined;
    this.innerTxns = [];
  }

  /**
   * Queries ASA Definitions data by assetID.  Returns undefined if ASA is not deployed.
   * @param assetId Asset Index
   */
  getAssetDef (assetId: number): modelsv2.AssetParams | undefined {
    const accountAddr = this.runtime.ctx.state.assetDefs.get(assetId);
    if (!accountAddr) return undefined;

    let account = this.runtime.ctx.state.accounts.get(accountAddr);
    account = this.runtime.assertAccountDefined(accountAddr, account);

    return account.createdAssets.get(assetId);
  }

  /**
   * Queries app (SSCAttributesM) from state. Throws TEAL.APP_NOT_FOUND if app is not found.
   * @param appID Application Index
   */
  getApp (appID: number, line: number): SSCAttributesM {
    return this.runtime.ctx.getApp(appID, line);
  }

  /**
   * Beginning from TEALv4, user can directly pass address instead of index to Txn.Accounts.
   * However, the address must still be present in tx.Accounts OR should be equal to Txn.Sender
   * @param accountPk public key of account
   * @param line line number in TEAL file
   * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
   */
  private _getAccountFromAddr (accountPk: Uint8Array, line: number): AccountStoreI {
    const txAccounts = this.runtime.ctx.tx.apat; // tx.Accounts array
    const appID = this.runtime.ctx.tx.apid ?? 0;
    if (this.tealVersion <= 3) {
      // address can only be passed directly since tealv4
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.PRAGMA_VERSION_ERROR, {
        expected: MaxTEALVersion,
        got: this.tealVersion,
        line: line
      });
    }

    // address must still be present in tx.Accounts OR should be equal to Txn.Sender
    const pkBuffer = Buffer.from(accountPk);
    const addr = encodeAddress(pkBuffer);
    if (!isValidAddress(addr)) { // invalid address
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.ADDR_NOT_VALID, {
        address: addr,
        line: line
      });
    }

    if (
      txAccounts?.find(buff => compareArray(Uint8Array.from(buff), accountPk)) !== undefined ||
      compareArray(accountPk, Uint8Array.from(this.runtime.ctx.tx.snd)) ||
      // since tealv5, currentApplicationAddress is also allowed (directly)
      compareArray(accountPk, decodeAddress(getApplicationAddress(appID)).publicKey)
    ) {
      const address = encodeAddress(pkBuffer);
      const account = this.runtime.ctx.state.accounts.get(address);
      return this.runtime.assertAccountDefined(address, account, line);
    } else {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.ADDR_NOT_FOUND_IN_TXN_ACCOUNT, {
        address: encodeAddress(pkBuffer),
        line: line
      });
    }
  }

  /**
   * Queries account by accountIndex or `ctx.tx.snd` (if `accountIndex==0`).
   * If account address is passed, then queries account by address.
   * Throws exception if account is not found.
   * @param accountRef index of account to fetch from account list
   * @param line line number
   * NOTE: index 0 represents txn sender account
   */
  getAccount (accountRef: StackElem, line: number): AccountStoreI {
    let account: AccountStoreI | undefined;
    let address: string;
    if (typeof accountRef === 'bigint') {
      if (accountRef === 0n) {
        address = encodeAddress(this.runtime.ctx.tx.snd);
        account = this.runtime.ctx.state.accounts.get(address);
      } else {
        const accIndex = accountRef - 1n;
        checkIndexBound(Number(accIndex), this.runtime.ctx.tx.apat ?? [], line);
        let pkBuffer;
        if (this.runtime.ctx.tx.apat) {
          pkBuffer = this.runtime.ctx.tx.apat[Number(accIndex)];
        } else {
          throw new Error("pk Buffer not found");
        }
        address = encodeAddress(pkBuffer);
        account = this.runtime.ctx.state.accounts.get(address);
      }
    } else {
      return this._getAccountFromAddr(accountRef, line);
    }

    return this.runtime.assertAccountDefined(address, account, line);
  }

  /**
   * Queries appIndex by app reference (offset to foreignApps array OR index directly)
   * + Since TEALv4, any reference is supported (but it must be present in foreignApps array)
   * + For older versions, if foreign === true, reference is treated as offset to foreignApps array,
   * otherwise it is treated as a direct reference.
   * @param appRef an offset to foreign app array OR appID
   * @param foreign for older teal versions(<= 3), foreign bool represent if ref is
   * treated as an offset/appIndex
   * @param line line number
   * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
   */
  getAppIDByReference (appRef: number, foreign: boolean, line: number, op: Op): number {
    const foreignApps = this.runtime.ctx.tx.apfa ?? [];
    if (this.tealVersion >= 4) {
      // In recent versions (tealv >= 4), accept either kind of Application reference
      if (appRef === 0) {
        return this.runtime.ctx.tx.apid as number;
      }
      if (appRef <= foreignApps.length) {
        return foreignApps[appRef - 1];
      }
      if (foreignApps.includes(appRef) || appRef === this.runtime.ctx.tx.apid) {
        return appRef;
      }
    } else {
      // Old rules
      if (foreign) {
        // In old versions, a foreign reference must be an index in ForeignApps or 0
        if (appRef === 0) {
          return this.runtime.ctx.tx.apid as number;
        }

        op.checkIndexBound(--appRef, foreignApps, line);
        return foreignApps[appRef];
      } else {
        // Otherwise it's direct
        return appRef;
      }
    }

    throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_APP_REFERENCE, {
      appRef: appRef,
      line: line
    });
  }

  /**
   * Queries assetIndex by asset reference (offset to foreignAssets array OR index directly)
   * + Since TEALv4, any reference is supported (but it must be present in foreign assets array)
   * + For older versions, if foreign === true, reference is treated as offset to foreignAssets array,
   * otherwise it is treated as a direct reference.
   * @param assetRef an offset to foreign assets array OR assetID
   * @param foreign for older teal versions(<= 3), foreign bool represent if
   * ref is treated as an offset/assetIndex
   * @param line line number
   * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
   */
  getAssetIDByReference (assetRef: number, foreign: boolean, line: number, op: Op): number {
    const appForeignAssets = this.runtime.ctx.tx.apas ?? [];
    if (this.tealVersion >= 4) {
      // In recent versions (tealv >= 4), accept either kind of ASA reference
      if (assetRef < appForeignAssets.length) {
        return appForeignAssets[assetRef];
      }
      if (appForeignAssets.includes(assetRef)) {
        return assetRef;
      }
    } else {
      // Old rules
      if (foreign) {
        // In old versions, a foreign reference must be an index in ForeignAssets
        op.checkIndexBound(assetRef, appForeignAssets, line);
        return appForeignAssets[assetRef];
      } else {
        // Otherwise it's direct
        return assetRef;
      }
    }

    throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_ASA_REFERENCE, {
      assetRef: assetRef,
      line: line
    });
  }

  /**
   * Queries application by application index. Returns undefined if app is not found.
   * @param appID: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appID: number, key: Uint8Array | string, line: number): StackElem | undefined {
    const app = this.runtime.assertAppDefined(appID, this.getApp(appID, line), line);
    const appGlobalState = app["global-state"];
    const globalKey = keyToBytes(key);
    return appGlobalState.get(globalKey.toString());
  }

  /**
   * Updates app global state.
   * Throws error if app is not found.
   * @param appID: application id
   * @param key: app global state key
   * @param value: value associated with a key
   */
  setGlobalState (appID: number, key: Uint8Array | string, value: StackElem, line: number): void {
    if (!this.runtime.ctx.state.globalApps.has(appID)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appID: appID, line: line });
    }
    const accAddress = this.runtime.assertAddressDefined(
      this.runtime.ctx.state.globalApps.get(appID));
    let account = this.runtime.ctx.state.accounts.get(accAddress);
    account = this.runtime.assertAccountDefined(accAddress, account);

    account.setGlobalState(appID, key, value, line);
  }

  /**
   * Description: moves instruction index to "label", throws error if label not found
   * @param label: branch label
   * @param line: line number
   */
  jumpForward (label: string, line: number): void {
    while (++this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      if (instruction instanceof Label && instruction.label === label) {
        // if next immediate op is also label, then keep continuing, otherwise return
        for (; this.instructionIndex < this.instructions.length - 1; ++this.instructionIndex) {
          const nextInstruction = this.instructions[this.instructionIndex + 1];
          if (!(nextInstruction instanceof Label)) { break; }
        }
        return;
      }
    }
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND, {
      label: label,
      line: line
    });
  }

  /**
   * Description: moves instruction index to "label", throws error if label not found
   * @param label: branch label
   * @param line: line number
   */
  jumpToLabel (label: string, line: number): void {
    const toInstructionIndex = this.labelMap.get(label);
    if (toInstructionIndex === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND, {
        label: label,
        line: line
      });
    }
    let currentIndex = toInstructionIndex;
    // if next immediate op is also label, then keep continuing, otherwise return
    for (; currentIndex < this.instructions.length - 1; ++currentIndex) {
      const nextInstruction = this.instructions[currentIndex + 1];
      if (!(nextInstruction instanceof Label)) {
        this.instructionIndex = currentIndex;
        break;
      }
    }
  }

  /**
   * logs TEALStack upto depth = debugStack to console
   * @param instruction interpreter opcode instance
   * @param debugStack max no. of elements to print from top of stack
   */
  printStack (instruction: Operator, debugStack?: number): void {
    if (!debugStack) { return; }
    console.info("stack(depth = %s) for opcode %s at line %s:",
      debugStack,
      instruction.constructor.name,
      instruction.line
    );
    const stack = this.stack.debug(debugStack);
    for (const top of stack) { console.log(" %O", top); }
    console.log("\n");
  }

  /**
   * Maps labels with indexes according to instructions array
   */
  mapLabelWithIndexes (): void {
    this.instructions.forEach((instruction, idx) => {
      if (instruction instanceof Label) {
        this.labelMap.set(instruction.label, idx);
      }
    });
  }

  /* Assets transaction references (apps, assets, accounts) lengths are valid:
   * 1. Application args are limited to max. size of 16.
   * 2. The AVM limits the accounts array to no more than 4
   * 3. Assets and application arrays combined and totaled with the accounts array can not exceed 8
   * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
   */
  assertValidTxArray (): void {
    const [appArgsLen, foreignAppsLen, foreignAssetsLen, txAccountsLen] = [
      this.runtime.ctx.tx.apaa?.length ?? 0,
      this.runtime.ctx.tx.apfa?.length ?? 0,
      this.runtime.ctx.tx.apas?.length ?? 0,
      this.runtime.ctx.tx.apat?.length ?? 0
    ];

    if (appArgsLen > ALGORAND_MAX_APP_ARGS_LEN) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APP_ARGS_LEN, {
        len: appArgsLen,
        max: ALGORAND_MAX_APP_ARGS_LEN
      });
    }
    if (txAccountsLen > ALGORAND_MAX_TX_ACCOUNTS_LEN) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_TX_ACCOUNTS_LEN, {
        len: txAccountsLen,
        max: ALGORAND_MAX_TX_ACCOUNTS_LEN
      });
    }
    const totalLen = txAccountsLen + foreignAppsLen + foreignAssetsLen;
    if (totalLen > ALGORAND_MAX_TX_ARRAY_LEN) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.MAX_REFERENCES_EXCEEDED, {
        len: totalLen,
        max: ALGORAND_MAX_TX_ARRAY_LEN
      });
    }
  }

  /**
   * This function executes TEAL code after parsing
   * @param program: teal code
   * @param mode : execution mode of TEAL code (Stateless or Stateful)
   * @param runtime : runtime object
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   */
  execute (program: string, mode: ExecutionMode, runtime: Runtime, debugStack?: number): void {
    const result = this.executeWithResult(program, mode, runtime, debugStack);
    if (result !== undefined && typeof result === 'bigint' && result > 0n) {
      return;
    }

    throw new RuntimeError(RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
  }

  /**
   * This function executes TEAL code after parsing and returns the result of the program.
   * @param program: teal code
   * @param mode : execution mode of TEAL code (smart signature or contract)
   * @param runtime : runtime object
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   * @returns The final result on the stack or undefined if nothing was on the stack.
   * NOTE: program should fail if there is no result (stack is empty after the execution) or
   *       the result is zero.
   */
  executeWithResult (program: string, mode: ExecutionMode, runtime: Runtime,
    debugStack?: number): StackElem | undefined {
    this.runtime = runtime;
    this.instructions = parser(program, mode, this);

    this.mapLabelWithIndexes();
    if (mode === ExecutionMode.APPLICATION) { this.assertValidTxArray(); }

    let dynamicCost = 0;
    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      instruction.execute(this.stack);
      const txReceipt = this.runtime.ctx.state.txReceipts.get(this.runtime.ctx.tx.txID) as TxReceipt;

      // for teal version >= 4, cost is calculated dynamically at the time of execution
      // for teal version < 4, cost is handled statically during parsing
      dynamicCost += this.lineToCost[instruction.line];
      if (this.tealVersion < 4) { txReceipt.gas = this.gas; }
      if (this.tealVersion >= 4) {
        if (mode === ExecutionMode.SIGNATURE) {
          assertMaxCost(dynamicCost, mode);
          txReceipt.gas = dynamicCost;
        } else {
          this.runtime.ctx.pooledApplCost += this.lineToCost[instruction.line];
          const maxPooledApplCost = MaxAppProgramCost * this.runtime.ctx.gtxs.length;
          assertMaxCost(this.runtime.ctx.pooledApplCost, ExecutionMode.APPLICATION, maxPooledApplCost);
          txReceipt.gas = this.runtime.ctx.pooledApplCost;
        }
      }

      this.printStack(instruction, debugStack);
      this.instructionIndex++;
    }

    let result: StackElem | undefined;
    if (this.stack.length() === 1) {
      result = this.stack.pop();
    }
    return result;
  }
}
