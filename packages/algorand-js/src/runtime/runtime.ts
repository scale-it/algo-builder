/* eslint sonarjs/no-duplicate-string: 0 */
/* eslint sonarjs/no-small-switch: 0 */
import { mkTransaction } from "@algorand-builder/algob";
import { ExecParams, TransactionType } from "@algorand-builder/algob/src/types";
import { AssetDef, AssetHolding, assignGroupID, SSCParams, SSCStateSchema } from "algosdk";
import cloneDeep from "lodash/cloneDeep";

import { getProgram } from "../../test/helpers/fs";
import { mockSuggestedParams } from "../../test/mocks/txn";
import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Interpreter } from "../index";
import { BIGINT0, BIGINT1 } from "../interpreter/opcode-list";
import { checkIndexBound, compareArray } from "../lib/compare";
import { convertToString } from "../lib/parsing";
import { assertValidSchema, getKeyValPair } from "../lib/stateful";
import type { Context, StackElem, State, StoreAccount, Txn } from "../types";

export class Runtime {
  /**
   * We are duplicating `accounts` data in `accountAssets`
   * because of faster and easy querying.
   * The structure in `accountAssets` is:
   * Map < accountAddress, Map <AssetId, AssetHolding> >
   * This way when querying, instead of traversing the whole object,
   * we can get the value directly from Map
   */
  private store: State;
  ctx: Context;

  constructor (accounts: StoreAccount[]) {
    // runtime store
    const assetInfo = new Map<number, AssetHolding>();
    this.store = {
      accounts: new Map<string, StoreAccount>(),
      accountAssets: new Map<string, typeof assetInfo>(),
      globalApps: new Map<number, SSCParams>(),
      assetDefs: new Map<number, AssetDef>()
    };

    // intialize accounts (should be done during runtime initialization)
    this.initializeAccounts(accounts);

    // context for interpreter
    this.ctx = {
      state: cloneDeep(this.store), // state is a deep copy of store
      tx: <Txn>{},
      gtxs: [],
      args: []
    };
  }

  assertAccountDefined (a?: StoreAccount): StoreAccount {
    if (a === undefined) {
      throw new TealError(ERRORS.TEAL.ACCOUNT_DOES_NOT_EXIST);
    }
    return a;
  }

  assertAppDefined (appId: number): SSCParams {
    const app = this.ctx.state.globalApps.get(appId);
    if (app === undefined) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND);
    }
    return app;
  }

  getAccount (accountIndex: bigint): StoreAccount {
    let account: StoreAccount | undefined;
    if (accountIndex === BIGINT0) {
      const senderAccount = convertToString(this.ctx.tx.snd);
      account = this.ctx.state.accounts.get(senderAccount);
    } else {
      const accIndex = accountIndex - BIGINT1;
      checkIndexBound(Number(accIndex), this.ctx.tx.apat);
      const pkBuffer = this.ctx.tx.apat[Number(accIndex)];
      account = this.ctx.state.accounts.get(convertToString(pkBuffer));
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
    const app = this.assertAppDefined(appId);
    const appGlobalState = app["global-state"];

    const keyValue = appGlobalState.find(schema => compareArray(schema.key, key));
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
    const app = this.assertAppDefined(appId);
    const appGlobalState = app["global-state"];

    const data = getKeyValPair(key, value); // key value pair to put
    const idx = appGlobalState.findIndex(schema => compareArray(schema.key, key));
    if (idx === -1) {
      appGlobalState.push(data); // push new pair if key not found
    } else {
      appGlobalState[idx].value = data.value; // update value if key found
    }
    app["global-state"] = appGlobalState; // save updated state

    assertValidSchema(app["global-state"], app["global-state-schema"]); // verify if updated schema is valid by config
    return appGlobalState;
  }

  /**
   * Setup initial accounts as {address: SDKAccount}. This should be called only when initializing Runtime.
   * @param accounts: array of account info's
   */
  initializeAccounts (accounts: StoreAccount[]): void {
    for (const acc of accounts) {
      this.store.accounts.set(acc.address, acc);

      for (const app of acc.createdApps) {
        this.store.globalApps.set(app.id, app.params);
      }

      for (const asset of acc.createdAssets) {
        this.store.assetDefs.set(asset.index, asset.params);
      }

      // Here we are duplicating `accounts` data
      // to `accountAssets` for easy querying
      const assets = acc.assets;
      const assetInfo = new Map<number, AssetHolding>();
      for (const asset of assets) {
        assetInfo.set(asset["asset-id"], asset);
      }

      this.store.accountAssets.set(acc.address, assetInfo);
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

  // updates account balance as per transaction parameters
  updateBalance (txnParam: ExecParams, account: StoreAccount): void {
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
  prepareFinalState (txnParams: ExecParams | ExecParams[]): void {
    if (Array.isArray(txnParams)) { // if txn is a group, update balance as per 'each' transaction
      for (const txnParam of txnParams) {
        this.store.accounts.forEach((account, addr) => {
          this.updateBalance(txnParam, account);
        });
      }
    } else {
      // for a single (stand alone) transaction
      this.store.accounts.forEach((account, addr) => {
        this.updateBalance(txnParams, account);
      });
    }
  }

  /**
   * Description: this function executes a transaction based on a smart
   * contract logic and updates state afterwards
   * @param txnParams : Transaction parameters
   * @param fileName : smart contract file (.teal) name in assets/
   * @param args : external arguments to smart contract
   */
  async executeTx (txnParams: ExecParams | ExecParams[], fileName: string,
    args: Uint8Array[]): Promise<void> {
    const [tx, gtxs] = this.createTxnContext(txnParams); // get current txn and txn group (as encoded obj)

    // initialize context before each execution
    this.ctx = {
      state: cloneDeep(this.store), // state is a deep copy of store
      tx: tx,
      gtxs: gtxs,
      args: args
    };

    const program = getProgram(fileName); // get TEAL code as string
    const interpreter = new Interpreter();
    await interpreter.execute(program, this);

    this.store = this.ctx.state; // update state after successful execution('local-state', 'global-state'..)
    this.prepareFinalState(txnParams); // update account balances
  }
}
