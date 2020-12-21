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
import type { Context, SDKAccount, StackElem, State, Txn } from "../types";

export class Runtime {
  interpreter: Interpreter;
  store: State;

  constructor (interpreter: Interpreter) {
    this.interpreter = interpreter;
    this.store = {
      accounts: new Map<string, SDKAccount>(),
      globalApps: new Map<number, SSCParams>()
    };
  }

  assertAccountDefined (a?: SDKAccount): SDKAccount {
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

  getAccount (accountIndex: bigint): SDKAccount {
    let account: SDKAccount | undefined;
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
   * Setup initial accounts as {address: SDKAccount}. This should be called only when initializing Runtime.
   * @param accounts: array of account info's
   */
  createStatefulContext (accounts: SDKAccount[]): void {
    for (const acc of accounts) {
      this.store.accounts.set(acc.address, acc);

      for (const app of acc.createdApps) {
        this.store.globalApps.set(app.id, app.params);
      }
    }
  }

  /**
   * Description: creates a new transaction object from given execParams
   * @param txnParams : Transaction parameters for current txn or txn Group
   * @returns: [current transaction, transaction group]
   */
  createTxnContext (txnParams: ExecParams | ExecParams[]): [Txn, Txn[]] {
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
      return [txns[0], txns]; // by default current txn is the first txn (hence txns[0])
    } else {
      // if not array, then create a single transaction
      const mockParams = mockSuggestedParams(txnParams.payFlags);
      const tx = mkTransaction(txnParams, mockParams);

      const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
      encodedTxnObj.txID = tx.txID();
      return [encodedTxnObj, [encodedTxnObj]];
    }
  }

  prepareInitialState (txnParams: ExecParams| ExecParams[], accounts: SDKAccount[]): Context {
    const [tx, gtxs] = this.createTxnContext(txnParams); // get current txn and txn group (as encoded obj)
    this.createStatefulContext(accounts); // initialize state before execution
    return {
      state: this.store, // state is a copy of store
      tx: tx,
      gtxs: gtxs
    };
  }

  // updates account balance as per transaction parameters
  updateBalance (txnParam: ExecParams, account: SDKAccount): void {
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
  prepareFinalState (txnParams: ExecParams | ExecParams[], accounts: SDKAccount[]): void {
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
    args: Uint8Array[], accounts: SDKAccount[]): Promise<void> {
    const context = this.prepareInitialState(txnParams, accounts); // prepare initial state

    const program = getProgram(fileName);
    const updatedState = await this.interpreter.execute(program, args, this, context);
    this.store = updatedState; // update state after successful execution('local-state', 'global-state'..)
    this.prepareFinalState(txnParams, accounts); // update account balances
  }
}
