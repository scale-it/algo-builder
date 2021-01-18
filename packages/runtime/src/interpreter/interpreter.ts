import { AssetDef, encodeAddress } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Runtime } from "../index";
import { checkIndexBound } from "../lib/compare";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { keyToBytes } from "../lib/parsing";
import { Stack } from "../lib/stack";
import { assertValidSchema } from "../lib/stateful";
import { parser } from "../parser/parser";
import type { Operator, SSCAttributesM, StackElem, StoreAccountI, TEALStack } from "../types";
import { BIGINT0, BIGINT1, Label } from "./opcode-list";

const globalState = "global-state";

export class Interpreter {
  /**
   * Note: Interpreter operates on only ctx, current context of runtime
   * All the functions fetches and sets the values only in current context, not in `runtime.store`.
   */
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  instructions: Operator[];
  instructionIndex: number;
  runtime: Runtime;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.instructions = [];
    this.instructionIndex = 0; // set instruction index to zero
    this.runtime = <Runtime>{};
  }

  /**
   * Fetches Asset Definition for given asset index from current context (ctx)
   * @param assetId Asset Index
   */
  getAssetDef (assetId: number): AssetDef | undefined {
    const accountAddr = this.runtime.ctx.state.assetDefs.get(assetId);
    if (!accountAddr) return undefined;

    let account = this.runtime.ctx.state.accounts.get(accountAddr);
    account = this.runtime.assertAccountDefined(account);

    return account.createdAssets.get(assetId);
  }

  /**
   * Queries app (SSCAttributesM) from state. Throws TEAL.APP_NOT_FOUND if app is not found.
   * @param appId Application Index
   */
  getApp (appId: number, line: number): SSCAttributesM | undefined {
    if (!this.runtime.ctx.state.globalApps.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId, line: line });
    }
    const accAddress = this.runtime.assertAddressDefined(
      this.runtime.ctx.state.globalApps.get(appId));
    const account = this.runtime.ctx.state.accounts.get(accAddress);
    return account?.createdApps.get(appId);
  }

  /**
   * Fetch account using accountIndex from `Accounts` list
   * Accounts: List of accounts in addition to the sender
   * that may be accessed from the application's approval-program and clear-state-program.
   * @param accountIndex index of account to fetch from account list
   * @param line line number
   * NOTE: index 0 represents txn sender account
   */
  getAccount (accountIndex: bigint, line: number): StoreAccountI {
    let account: StoreAccountI | undefined;
    if (accountIndex === BIGINT0) {
      const senderAccount = encodeAddress(this.runtime.ctx.tx.snd);
      account = this.runtime.ctx.state.accounts.get(senderAccount);
    } else {
      const accIndex = accountIndex - BIGINT1;
      checkIndexBound(Number(accIndex), this.runtime.ctx.tx.apat, line);
      const pkBuffer = this.runtime.ctx.tx.apat[Number(accIndex)];
      account = this.runtime.ctx.state.accounts.get(encodeAddress(pkBuffer));
    }
    return this.runtime.assertAccountDefined(account, line);
  }

  /**
   * Fetches global state value for key present in creator's global state
   * for given appId, returns undefined otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appId: number, key: Uint8Array | string, line: number): StackElem | undefined {
    const app = this.runtime.assertAppDefined(this.getApp(appId, line), line);
    const appGlobalState = app[globalState];
    const globalKey = keyToBytes(key);
    return appGlobalState.get(globalKey.toString());
  }

  /**
   * Add new key-value pair or updating pair with existing key in
   * app's global data for application id: appId, throw error otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   * @param value: key to fetch value of from local state
   */
  setGlobalState (appId: number, key: Uint8Array | string, value: StackElem, line: number): void {
    const app = this.runtime.assertAppDefined(this.getApp(appId, line), line);
    const appGlobalState = app[globalState];
    const globalKey = keyToBytes(key);
    appGlobalState.set(globalKey.toString(), value); // set new value in global state
    app["global-state"] = appGlobalState; // save updated state

    assertValidSchema(app[globalState], app["global-state-schema"]); // verify if updated schema is valid by config
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
    throw new TealError(ERRORS.TEAL.LABEL_NOT_FOUND, {
      label: label,
      line: line
    });
  }

  /**
   * Description: this function executes TEAL code after parsing
   * @param {string} program: teal code
   * @param {Runtime} runtime : runtime object
   */
  async execute (program: string, runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    this.instructions = await parser(program, this);

    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      instruction.execute(this.stack);
      this.instructionIndex++;
    }

    if (this.stack.length() === 1) {
      const s = this.stack.pop();

      if (!(s instanceof Uint8Array) && s > BIGINT0) { return; }
    }
    throw new TealError(ERRORS.TEAL.REJECTED_BY_LOGIC);
  }
}
