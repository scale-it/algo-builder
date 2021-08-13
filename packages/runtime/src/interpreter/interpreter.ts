import { encodeAddress, modelsv2 } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Runtime } from "../index";
import { checkIndexBound, compareArray } from "../lib/compare";
import { ALGORAND_MAX_APP_ARGS_LEN, ALGORAND_MAX_TX_ACCOUNTS_LEN, ALGORAND_MAX_TX_ARRAY_LEN, DEFAULT_STACK_ELEM, MaxTEALVersion } from "../lib/constants";
import { keyToBytes } from "../lib/parsing";
import { Stack } from "../lib/stack";
import { parser } from "../parser/parser";
import {
  AccountStoreI, ExecutionMode, Operator, SSCAttributesM,
  StackElem, TEALStack
} from "../types";
import { Op } from "./opcode";
import { Label } from "./opcode-list";

export class Interpreter {
  /**
   * Note: Interpreter operates on `ctx`, it doesn't operate on `store`.
   * All the functions query or update only a state copy from the interpreter, not the `runtime.store`.
   */
  readonly stack: TEALStack;
  tealVersion: number; // LogicSigVersion
  gas: number; // total gas cost of TEAL code
  length: number; // total length of 'compiled' TEAL code
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  instructions: Operator[];
  instructionIndex: number;
  runtime: Runtime;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.tealVersion = 1; // LogicSigVersion = 1 by default (if not specified by pragma)
    this.gas = 0; // initial cost
    this.length = 0; // initial length
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.instructions = [];
    this.instructionIndex = 0; // set instruction index to zero
    this.runtime = <Runtime>{};
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
    if (
      txAccounts?.find(buff => compareArray(Uint8Array.from(buff), accountPk)) ??
      compareArray(accountPk, Uint8Array.from(this.runtime.ctx.tx.snd))
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
        checkIndexBound(Number(accIndex), this.runtime.ctx.tx.apat as Buffer[], line);
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
   * Queries appIndex from Txn.ForeignApps or `ctx.tx.apid` (current app if `appIndex==0`).
   * If appIndex is passed directly, then verifies that appID is present in foreignApps array.
   * @param appRef index to foreign apps array OR applicationID
   * @param line line number
   * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
   */
  getAppID (appRef: number, foreign: boolean, line: number, op: Op): number {
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
   * Queries assetIndex from Txn.ForeignAssets (note: index 0 means first asset in foreign asset array).
   * If assetIndex is passed directly, then verifies that assetIndex is present in ForeignAssets array.
   * @param assetRef an offset to foreign assets array OR assetID
   * @param line line number
   * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
   */
  getAssetID (assetRef: number, foreign: boolean, line: number, op: Op): number {
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
   * Assets transaction references (apps, assets, accounts) lengths are valid:
   * 1. The AVM limits the accounts array to no more than 4
   * 2. Assets and application arrays combined and totaled with the accounts array can not exceed 8
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
    this.runtime = runtime;
    this.instructions = parser(program, mode, this);
    if (mode === ExecutionMode.APPLICATION) { this.assertValidTxArray(); }

    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      instruction.execute(this.stack);

      this.printStack(instruction, debugStack);
      this.instructionIndex++;
    }

    if (this.stack.length() === 1) {
      const s = this.stack.pop();

      if (!(s instanceof Uint8Array) && s > 0n) { return; }
    }
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
  }
}
