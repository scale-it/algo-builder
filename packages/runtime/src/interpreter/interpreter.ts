import { AssetDef, encodeAddress } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Runtime } from "../index";
import { checkIndexBound } from "../lib/compare";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { keyToBytes } from "../lib/parsing";
import { Stack } from "../lib/stack";
import { parser } from "../parser/parser";
import type {
  ExecutionMode, Operator, SSCAttributesM,
  StackElem, StoreAccountI, TEALStack
} from "../types";
import { BIGINT0, BIGINT1, Label } from "./opcode-list";

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
  getAssetDef (assetId: number): AssetDef | undefined {
    const accountAddr = this.runtime.ctx.state.assetDefs.get(assetId);
    if (!accountAddr) return undefined;

    let account = this.runtime.ctx.state.accounts.get(accountAddr);
    account = this.runtime.assertAccountDefined(accountAddr, account);

    return account.createdAssets.get(assetId);
  }

  /**
   * Queries app (SSCAttributesM) from state. Throws TEAL.APP_NOT_FOUND if app is not found.
   * @param appId Application Index
   */
  getApp (appId: number, line: number): SSCAttributesM {
    if (!this.runtime.ctx.state.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: line });
    }
    const accAddress = this.runtime.assertAddressDefined(
      this.runtime.ctx.state.globalApps.get(appId));
    let account = this.runtime.ctx.state.accounts.get(accAddress);
    account = this.runtime.assertAccountDefined(accAddress, account);
    return this.runtime.assertAppDefined(appId, account.getApp(appId), line);
  }

  /**
   * Queries account by accountIndex or `ctx.tx.snd` (if `accountIndex==0`).
   * Throws exception if account is not found.
   * @param accountIndex index of account to fetch from account list
   * @param line line number
   * NOTE: index 0 represents txn sender account
   */
  getAccount (accountIndex: bigint, line: number): StoreAccountI {
    let account: StoreAccountI | undefined;
    let address: string;
    if (accountIndex === BIGINT0) {
      address = encodeAddress(this.runtime.ctx.tx.snd);
      account = this.runtime.ctx.state.accounts.get(address);
    } else {
      const accIndex = accountIndex - BIGINT1;
      checkIndexBound(Number(accIndex), this.runtime.ctx.tx.apat, line);
      const pkBuffer = this.runtime.ctx.tx.apat[Number(accIndex)];
      address = encodeAddress(pkBuffer);
      account = this.runtime.ctx.state.accounts.get(address);
    }
    return this.runtime.assertAccountDefined(address, account, line);
  }

  /**
   * Queries application by application index. Returns undefined if app is not found.
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appId: number, key: Uint8Array | string, line: number): StackElem | undefined {
    const app = this.runtime.assertAppDefined(appId, this.getApp(appId, line), line);
    const appGlobalState = app["global-state"];
    const globalKey = keyToBytes(key);
    return appGlobalState.get(globalKey.toString());
  }

  /**
   * Updates app global state.
   * Throws error if app is not found.
   * @param appId: application id
   * @param key: app global state key
   * @param value: value associated with a key
   */
  setGlobalState (appId: number, key: Uint8Array | string, value: StackElem, line: number): void {
    if (!this.runtime.ctx.state.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: line });
    }
    const accAddress = this.runtime.assertAddressDefined(
      this.runtime.ctx.state.globalApps.get(appId));
    let account = this.runtime.ctx.state.accounts.get(accAddress);
    account = this.runtime.assertAccountDefined(accAddress, account);

    account.setGlobalState(appId, key, value, line);
  }

  /**
   * Description: moves instruction index to "label", throws error if label not found
   * @param label: branch label
   */
  jumpForward (label: string, line: number): void {
    while (++this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      if (instruction instanceof Label && instruction.label === label) {
        return;
      }
    }
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND, {
      label: label,
      line: line
    });
  }

  /**
   * This function executes TEAL code after parsing
   * @param program: teal code
   * @param mode : execution mode of TEAL code (Stateless or Stateful)
   * @param runtime : runtime object
   */
  execute (program: string, mode: ExecutionMode, runtime: Runtime): void {
    this.runtime = runtime;
    this.instructions = parser(program, mode, this);

    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      instruction.execute(this.stack);
      this.instructionIndex++;
    }

    if (this.stack.length() === 1) {
      const s = this.stack.pop();

      if (!(s instanceof Uint8Array) && s > BIGINT0) { return; }
    }
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
  }
}
