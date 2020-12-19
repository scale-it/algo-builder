/* eslint sonarjs/no-duplicate-string: 0 */
/* eslint sonarjs/no-small-switch: 0 */
import { mkTransaction } from "algob";
import { ExecParams, TransactionType } from "algob/src/types";
import { getProgram } from "algob/test/helpers/fs";
import { assignGroupID, SSCParams, SSCStateSchema } from "algosdk";

import { mockSuggestedParams } from "../../build/test/mocks/txn";
import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Interpreter } from "../index";
import { BIGINT0 } from "../interpreter/opcode-list";
import { checkIndexBound, compareArray } from "../lib/compare";
import { convertToString } from "../lib/parsing";
import { assertValidSchema, getKeyValPair } from "../lib/stateful";
import type { Context, SdkAccount, StackElem, Txn } from "../types";

export class Runtime {
  interpreter: Interpreter;
  store: Context;

  constructor (interpreter: Interpreter) {
    this.interpreter = interpreter;
    this.store = {
      state: {
        accounts: new Map<string, SdkAccount>(),
        globalApps: new Map<number, SSCParams>()
      },
      tx: <Txn>{},
      gtxs: []
    };
  }

  assertAccountDefined (a?: SdkAccount): SdkAccount {
    if (a === undefined) {
      throw new TealError(ERRORS.TEAL.ACCOUNT_DOES_NOT_EXIST);
    }
    return a;
  }

  assertAppDefined (appId: number): SSCParams {
    const globalDelta = this.interpreter.ctx.state.globalApps.get(appId);
    if (globalDelta === undefined) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND);
    }
    return globalDelta;
  }

  getAccount (accountIndex: bigint): SdkAccount {
    let account: SdkAccount | undefined;
    if (accountIndex === BIGINT0) {
      const senderAccount = convertToString(this.interpreter.ctx.tx.snd);
      account = this.interpreter.ctx.state.accounts.get(senderAccount);
    } else {
      accountIndex--;
      checkIndexBound(Number(accountIndex), this.interpreter.ctx.tx.apat);
      const pkBuffer = this.interpreter.ctx.tx.apat[Number(accountIndex)];
      account = this.interpreter.ctx.state.accounts.get(convertToString(pkBuffer));
    }
    return this.assertAccountDefined(account);
  }

  /**
   * Description: fetches global state value for key present app's global data
   * returns undefined otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appId: number, key: Uint8Array): StackElem | undefined {
    const appDelta = this.assertAppDefined(appId);
    const globalState = appDelta["global-state"];

    const keyValue = globalState.find(schema => compareArray(schema.key, key));
    const value = keyValue?.value;
    if (value) {
      return value?.bytes || BigInt(value?.uint);
    }
    return undefined;
  }

  /**
   * Description: add new key-value pair or updating pair with existing key in
   * app's global data for application id: appId, throw error otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   * @param value: key to fetch value of from local state
   */
  updateGlobalState (appId: number, key: Uint8Array, value: StackElem): SSCStateSchema[] {
    const appDelta = this.assertAppDefined(appId);
    const globalState = appDelta["global-state"];

    const data = getKeyValPair(key, value); // key value pair to put
    const idx = globalState.findIndex(schema => compareArray(schema.key, key));
    if (idx === -1) {
      globalState.push(data); // push new pair if key not found
    } else {
      globalState[idx].value = data.value; // update value if key found
    }
    appDelta["global-state"] = globalState; // save updated state

    assertValidSchema(appDelta["global-state"], appDelta["global-state-schema"]); // verify if updated schema is valid by config
    return globalState;
  }

  /**
   * Description: set accounts for context as {address: SdkAccount}
   * @param accounts: array of account info's
   */
  createStatefulContext (accounts: SdkAccount[]): void {
    for (const acc of accounts) {
      this.store.state.accounts.set(acc.address, acc);

      for (const app of acc.createdApps) {
        this.store.state.globalApps.set(app.id, app.params);
      }
    }
  }

  /**
   * Description: creates a new transaction object from given execParams
   * @param txnParams : Transaction parameters for current txn or txn Group
   */
  createTxnContext (txnParams: ExecParams | ExecParams[]): void {
    // if txnParams is array, then user is requesting for a group txn
    if (Array.isArray(txnParams)) {
      if (txnParams.length > 16) {
        throw new Error("Maximum size of an atomic transfer group is 16");
      }

      const txns = [];
      for (const txnParam of txnParams) { // create encoded_obj for each txn in group
        const mockParams = mockSuggestedParams(txnParam.payFlags);
        const tx = mkTransaction(txnParam, mockParams);

        // convert to encoded obj for compatibility
        const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
        encodedTxnObj.txID = tx.txID();
        txns.push(encodedTxnObj);
      }
      assignGroupID(txns); // assign unique groupID to all transactions in the array/group
      this.store.gtxs = txns;
      this.store.tx = txns[0]; // by default current txn is the first txn
    } else {
      // if not array, then create a single transaction
      const mockParams = mockSuggestedParams(txnParams.payFlags);
      const tx = mkTransaction(txnParams, mockParams);

      const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
      encodedTxnObj.txID = tx.txID();
      this.store.tx = encodedTxnObj; // assign current txn
      this.store.gtxs = [this.store.tx]; // assign single txn to grp
    }
  }

  prepareInitialState (txnParams: ExecParams| ExecParams[], accounts: SdkAccount[]): void {
    this.createTxnContext(txnParams);
    this.createStatefulContext(accounts); // initialize state before execution
  }

  // updates account balance as per transaction parameters
  updateBalance (txnParam: ExecParams, account: SdkAccount): void {
    switch (txnParam.type) {
      case TransactionType.TransferAlgo: {
        switch (account.address) {
          case txnParam.fromAccount.addr: {
            account.amount -= txnParam.amountMicroAlgos; // remove 'x' algo from sender
            break;
          }
          case txnParam.toAccountAddr: {
            account.amount += txnParam.amountMicroAlgos; // add 'x' algo to receiver
            break;
          }
        }
      }
    }
  }

  /**
   * Description: update current state and account balances
   * @param txnParams : Transaction parameters
   * @param accounts : accounts passed by user
   */
  prepareFinalState (txnParams: ExecParams | ExecParams[], accounts: SdkAccount[]): void {
    if (Array.isArray(txnParams)) { // if txn is a group, update balance as per 'each' transaction
      for (const txnParam of txnParams) {
        for (const acc of accounts) {
          this.updateBalance(txnParam, acc);
        }
      }
    } else {
      // for a single (stand alone) transaction
      for (const acc of accounts) {
        this.updateBalance(txnParams, acc);
      }
    }
  }

  /**
   * Description: this function executes a transaction based on a smart
   * contract logic and updates state afterwards
   * @param txn : Transaction parameters
   * @param fileName : smart contract file (.teal) name in assets/
   * @param args : external arguments to smart contract
   * @param accounts : accounts passed by the user
   */
  async executeTx (txnParams: ExecParams | ExecParams[], fileName: string,
    args: Uint8Array[], accounts: SdkAccount[]): Promise<void> {
    this.prepareInitialState(txnParams, accounts); // prepare initial state

    const program = getProgram(fileName);
    const updatedState = await this.interpreter.execute(program, args, this);
    this.store.state = updatedState; // update state after successful execution('local-state', 'global-state'..)
    this.prepareFinalState(txnParams, accounts); // update account balances
  }
}
