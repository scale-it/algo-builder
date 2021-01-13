/* eslint sonarjs/no-duplicate-string: 0 */
/* eslint sonarjs/no-small-switch: 0 */
import { mkTransaction } from "@algorand-builder/algob";
import { AlgoTransferParam, ExecParams, SSCDeploymentFlags, SSCOptionalFlags, TransactionType, TxParams } from "@algorand-builder/algob/src/types";
import algosdk, { AssetDef, AssetHolding, encodeAddress, SSCAttributes, SSCStateSchema } from "algosdk";
import cloneDeep from "lodash/cloneDeep";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Interpreter } from "../index";
import { BIGINT0, BIGINT1 } from "../interpreter/opcode-list";
import { checkIndexBound, compareArray } from "../lib/compare";
import { SSC_BYTES } from "../lib/constants";
import { assertValidSchema, getKeyValPair } from "../lib/stateful";
import { mockSuggestedParams } from "../mock/tx";
import type { Context, StackElem, State, StoreAccountI, Txn } from "../types";

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
  private appCounter: number;

  constructor (accounts: StoreAccountI[]) {
    // runtime store
    const assetInfo = new Map<number, AssetHolding>();
    this.store = {
      accounts: new Map<string, StoreAccountI>(),
      accountAssets: new Map<string, typeof assetInfo>(),
      globalApps: new Map<number, SSCAttributes>(),
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
    this.appCounter = 0;
  }

  assertAccountDefined (a?: StoreAccountI): StoreAccountI {
    if (a === undefined) {
      throw new TealError(ERRORS.TEAL.ACCOUNT_DOES_NOT_EXIST);
    }
    return a;
  }

  assertAppDefined (appId: number): SSCAttributes {
    const app = this.ctx.state.globalApps.get(appId);
    if (app === undefined) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId });
    }
    return app;
  }

  getAccount (accountIndex: bigint): StoreAccountI {
    let account: StoreAccountI | undefined;
    if (accountIndex === BIGINT0) {
      const senderAccount = encodeAddress(this.ctx.tx.snd);
      account = this.ctx.state.accounts.get(senderAccount);
    } else {
      const accIndex = accountIndex - BIGINT1;
      checkIndexBound(Number(accIndex), this.ctx.tx.apat);
      const pkBuffer = this.ctx.tx.apat[Number(accIndex)];
      account = this.ctx.state.accounts.get(encodeAddress(pkBuffer));
    }
    return this.assertAccountDefined(account);
  }

  /**
   * Fetches global state value for key present app's global data
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
      return value.type === SSC_BYTES ? value.bytes : BigInt(value.uint);
    }
    return undefined;
  }

  /**
   * Add new key-value pair or updating pair with existing key in
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
  initializeAccounts (accounts: StoreAccountI[]): void {
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
   * Creates new transaction object (tx, gtxs) from given txnParams
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

  // creates new application transaction object and update context
  createApplicationTx (flags: SSCDeploymentFlags, payFlags: TxParams): void {
    const txn = algosdk.makeApplicationCreateTxn(
      flags.sender.addr,
      mockSuggestedParams(payFlags),
      algosdk.OnApplicationComplete.NoOpOC,
      new Uint8Array(32), // mock approval program
      new Uint8Array(32), // mock clear progam
      flags.localInts,
      flags.localBytes,
      flags.globalInts,
      flags.globalBytes,
      flags.appArgs,
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      flags.rekeyTo);

    const encTx = txn.get_obj_for_encoding();
    encTx.txID = txn.txID();
    this.ctx.tx = encTx;
    this.ctx.gtxs = [encTx];
  }

  // creates new application and returns application id
  async addApp (flags: SSCDeploymentFlags, payFlags: TxParams, program: string): Promise<number> {
    const sender = flags.sender;
    const senderAcc = this.assertAccountDefined(this.store.accounts.get(sender.addr));

    // create app with id = 0 in globalApps for teal execution
    const app = senderAcc.addApp(0, flags);
    this.ctx.state.globalApps.set(app.id, app.params);

    this.createApplicationTx(flags, payFlags);
    await this.run(program); // execute TEAL code with appId = 0

    this.store.globalApps.set(++this.appCounter, app.params); // update globalApps Map
    this.ctx.state.globalApps.delete(0); // remove zero app

    // update local state
    senderAcc.createdApps.pop();
    senderAcc.addApp(this.appCounter, flags);
    this.store.accounts.set(sender.addr, senderAcc);
    return this.appCounter;
  }

  // creates new OptIn transaction object and update context
  createOptInTx (
    senderAddr: string,
    appId: number,
    payFlags: TxParams,
    flags: SSCOptionalFlags): void {
    const txn = algosdk.makeApplicationOptInTxn(
      senderAddr,
      mockSuggestedParams(payFlags),
      appId,
      flags.appArgs,
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      flags.rekeyTo);

    const encTx = txn.get_obj_for_encoding();
    encTx.txID = txn.txID();
    this.ctx.tx = encTx;
    this.ctx.gtxs = [encTx];
  }

  /**
   * Account address opt-in for application Id
   * @param accountAddr Account address
   * @param appId Application Id
   */
  async optInToApp (accountAddr: string, appId: number,
    flags: SSCOptionalFlags, payFlags: TxParams, program: string): Promise<void> {
    const appParams = this.store.globalApps.get(appId);
    const account = this.assertAccountDefined(this.store.accounts.get(accountAddr));
    if (appParams) {
      this.createOptInTx(accountAddr, appId, payFlags, flags);
      await this.run(program); // execute TEAL code

      account.optInToApp(appId, appParams);
    } else {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId });
    }
  }

  // creates new Update transaction object and update context
  createUpdateTx (
    senderAddr: string,
    appId: number,
    payFlags: TxParams,
    flags: SSCOptionalFlags): void {
    const txn = algosdk.makeApplicationUpdateTxn(
      senderAddr,
      mockSuggestedParams(payFlags),
      appId,
      new Uint8Array(32), // mock approval program
      new Uint8Array(32), // mock clear progam
      flags.appArgs,
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      flags.rekeyTo);

    const encTx = txn.get_obj_for_encoding();
    encTx.txID = txn.txID();
    this.ctx.tx = encTx;
    this.ctx.gtxs = [encTx];
  }

  /**
   * Update application
   * @param senderAddr sender address
   * @param appId application Id
   * @param newProgram updated program
   */
  async updateApp (
    senderAddr: string,
    appId: number,
    newProgram: string,
    payFlags: TxParams,
    flags: SSCOptionalFlags
  ): Promise<void> {
    const appParams = this.store.globalApps.get(appId);
    if (appParams) {
      this.createUpdateTx(senderAddr, appId, payFlags, flags);
      await this.run(newProgram); // execute TEAL code
    } else {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId });
    }
  }

  // Delete application from account's state and global state
  deleteApp (appId: number): void {
    if (!this.store.globalApps.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId });
    }
    const accountAddr = this.store.globalApps.get(appId)?.creator;
    if (accountAddr === undefined) {
      throw new TealError(ERRORS.TEAL.ACCOUNT_DOES_NOT_EXIST);
    }
    const account = this.assertAccountDefined(this.store.accounts.get(accountAddr));
    account.deleteApp(appId);
    this.store.globalApps.delete(appId);
  }

  // transfer ALGO as per transaction parameters
  transferAlgo (txnParam: AlgoTransferParam): void {
    const fromAccount = this.assertAccountDefined(this.store.accounts.get(txnParam.fromAccount.addr));
    const toAccount = this.assertAccountDefined(this.store.accounts.get(txnParam.toAccountAddr));

    fromAccount.amount -= txnParam.amountMicroAlgos; // remove 'x' algo from sender
    toAccount.amount += txnParam.amountMicroAlgos; // add 'x' algo to receiver
  }

  /**
   * Update current state and account balances
   * @param txnParams : Transaction parameters
   * @param accounts : accounts passed by user
   */
  prepareFinalState (txnParams: ExecParams | ExecParams[]): void {
    let txnParameters;
    if (!Array.isArray(txnParams)) {
      txnParameters = [txnParams];
    } else {
      txnParameters = txnParams;
    }
    for (const txnParam of txnParameters) {
      switch (txnParam.type) {
        case TransactionType.TransferAlgo:
          this.transferAlgo(txnParam);
          break;
        case TransactionType.DeleteSSC:
          this.deleteApp(txnParam.appId);
          break;
      }
    }
  }

  /**
   * This function executes a transaction based on a smart
   * contract logic and updates state afterwards
   * @param txnParams : Transaction parameters
   * @param fileName : smart contract file (.teal) name in assets/
   * @param args : external arguments to smart contract
   */
  async executeTx (txnParams: ExecParams | ExecParams[], program: string,
    args: Uint8Array[]): Promise<void> {
    const [tx, gtxs] = this.createTxnContext(txnParams); // get current txn and txn group (as encoded obj)
    // initialize context before each execution
    this.ctx = {
      state: cloneDeep(this.store), // state is a deep copy of store
      tx: tx,
      gtxs: gtxs,
      args: args
    };

    await this.run(program);
    this.prepareFinalState(txnParams); // update account balances
  }

  // execute teal code line by line
  async run (program: string): Promise<void> {
    const interpreter = new Interpreter();
    await interpreter.execute(program, this);
    this.store = this.ctx.state; // update state after successful execution('local-state', 'global-state'..)
  }
}
