/* eslint sonarjs/no-duplicate-string: 0 */
/* eslint sonarjs/no-small-switch: 0 */
import { ExecParams, mkTransaction, parseSSCAppArgs } from "@algorand-builder/algob";
import { AccountAddress, AlgoTransferParam, SSCDeploymentFlags, SSCOptionalFlags, TransactionType, TxParams } from "@algorand-builder/algob/src/types";
import algosdk from "algosdk";
import cloneDeep from "lodash/cloneDeep";

import { TealError } from "./errors/errors";
import { ERRORS } from "./errors/errors-list";
import { Interpreter } from "./index";
import { mockSuggestedParams } from "./mock/tx";
import type { Context, SSCAttributesM, StackElem, State, StoreAccountI, Txn } from "./types";

export class Runtime {
  /**
   * We are using Maps instead of algosdk arrays
   * because of faster and easy querying.
   * This way when querying, instead of traversing the whole object,
   * we can get the value directly from Map
   * Note: Runtime operates on `store`, it doesn't operate on `ctx`.
   */
  private store: State;
  ctx: Context;
  private appCounter: number;

  constructor (accounts: StoreAccountI[]) {
    // runtime store
    this.store = {
      accounts: new Map<string, StoreAccountI>(), // string represents account address
      globalApps: new Map<number, AccountAddress>(), // number represents appId
      assetDefs: new Map<number, AccountAddress>() // number represents assetId
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

  /**
   * asserts if account is defined.
   * @param a account
   * @param line line number in TEAL file
   * Note: if user is accessing this function directly through runtime,
   * the line number is unknown
   */
  assertAccountDefined (a?: StoreAccountI, line?: number): StoreAccountI {
    const lineNumber = line ?? 'unknown';
    if (a === undefined) {
      throw new TealError(ERRORS.TEAL.ACCOUNT_DOES_NOT_EXIST, { line: lineNumber });
    }
    return a;
  }

  /**
   * asserts if account address is defined
   * @param addr account address
   * @param line line number in TEAL file
   * Note: if user is accessing this function directly through runtime,
   * the line number is unknown
   */
  assertAddressDefined (addr: string | undefined, line?: number): string {
    if (addr === undefined) {
      throw new TealError(ERRORS.TEAL.ACCOUNT_DOES_NOT_EXIST, { line: line });
    }
    return addr;
  }

  /**
   * asserts if application exists in state
   * @param app application
   * @param appId application index
   * @param line line number in TEAL file
   * Note: if user is accessing this function directly through runtime,
   * the line number is unknown
   */
  assertAppDefined (appId: number, app?: SSCAttributesM, line?: number): SSCAttributesM {
    const lineNumber = line ?? 'unknown';
    if (app === undefined) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId, line: lineNumber });
    }
    return app;
  }

  /**
   * Fetches app from `this.store`
   * @param appId Application Index
   */
  getApp (appId: number): SSCAttributesM {
    if (!this.store.globalApps.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    const accAddress = this.assertAddressDefined(this.store.globalApps.get(appId));
    const account = this.assertAccountDefined(this.store.accounts.get(accAddress));
    return this.assertAppDefined(appId, account.getApp(appId));
  }

  /**
   * Fetches account from `this.store`
   * @param address account address
   */
  getAccount (address: string): StoreAccountI {
    const account = this.store.accounts.get(address);
    return this.assertAccountDefined(account);
  }

  /**
   * Fetches global state value for key present in creator's global state
   * for given appId, returns undefined otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appId: number, key: Uint8Array | string): StackElem | undefined {
    if (!this.store.globalApps.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    const accAddress = this.assertAddressDefined(this.store.globalApps.get(appId));
    const account = this.assertAccountDefined(this.store.accounts.get(accAddress));
    return account.getGlobalState(appId, key);
  }

  /**
   * Fetches local state for account address and application index
   * @param appId application index
   * @param accountAddr address for which local state needs to be retrieved
   * @param key: key to fetch value of from local state
   */
  getLocalState (appId: number, accountAddr: string, key: Uint8Array | string): StackElem | undefined {
    const account = this.assertAccountDefined(this.store.accounts.get(accountAddr));
    return account.getLocalState(appId, key);
  }

  /**
   * Setup initial accounts as {address: SDKAccount}. This should be called only when initializing Runtime.
   * @param accounts: array of account info's
   */
  initializeAccounts (accounts: StoreAccountI[]): void {
    for (const acc of accounts) {
      this.store.accounts.set(acc.address, acc);

      for (const appId of acc.createdApps.keys()) {
        this.store.globalApps.set(appId, acc.address);
      }

      for (const assetId of acc.createdAssets.keys()) {
        this.store.assetDefs.set(assetId, acc.address);
      }
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
  makeAndSetCtxAppCreateTxn (flags: SSCDeploymentFlags, payFlags: TxParams): void {
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
      parseSSCAppArgs(flags.appArgs),
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
   * creates new application and returns application id
   * Note: In this function we are operating on ctx to ensure that
   * the states are updated correctly
   * - First we are setting ctx according to application
   * - Second we run the TEAL code
   * - Finally if run is successful we update the store.
   * @param flags SSCDeployment flags
   * @param payFlags Transaction parameters
   * @param program approval program
   */
  async addApp (flags: SSCDeploymentFlags, payFlags: TxParams, program: string): Promise<number> {
    const sender = flags.sender;
    const senderAcc = this.assertAccountDefined(this.store.accounts.get(sender.addr));

    // create app with id = 0 in globalApps for teal execution
    const app = senderAcc.addApp(0, flags);
    this.ctx.state.accounts.set(senderAcc.address, senderAcc);
    this.ctx.state.globalApps.set(app.id, senderAcc.address);

    this.makeAndSetCtxAppCreateTxn(flags, payFlags);
    await this.run(program); // execute TEAL code with appId = 0

    // create new application in globalApps map
    this.store.globalApps.set(++this.appCounter, senderAcc.address);

    const attributes = this.assertAppDefined(0, senderAcc.createdApps.get(0));
    this.ctx.state.globalApps.delete(0); // remove zero app from context after execution
    senderAcc.createdApps.delete(0); // remove zero app from sender's account
    senderAcc.createdApps.set(this.appCounter, attributes);

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
      parseSSCAppArgs(flags.appArgs),
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
   * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
   * @param payFlags Transaction Parameters
   * @param program TEAL code as string
   */
  async optInToApp (accountAddr: string, appId: number,
    flags: SSCOptionalFlags, payFlags: TxParams, program: string): Promise<void> {
    const appParams = this.getApp(appId);
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
      parseSSCAppArgs(flags.appArgs),
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
   * @param payFlags Transaction parameters
   * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
   */
  async updateApp (
    senderAddr: string,
    appId: number,
    newProgram: string,
    payFlags: TxParams,
    flags: SSCOptionalFlags
  ): Promise<void> {
    const appParams = this.getApp(appId);
    if (appParams) {
      this.createUpdateTx(senderAddr, appId, payFlags, flags);
      await this.run(newProgram); // execute TEAL code
    } else {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId });
    }
  }

  /**
   * Delete application from account's state and global state
   * @param appId Application Index
   */
  deleteApp (appId: number): void {
    if (!this.store.globalApps.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId });
    }
    const accountAddr = this.store.globalApps.get(appId);
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
  updateFinalState (txnParams: ExecParams | ExecParams[]): void {
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
    this.updateFinalState(txnParams); // update account balances
  }

  // execute teal code line by line
  async run (program: string): Promise<void> {
    const interpreter = new Interpreter();
    await interpreter.execute(program, this);
    this.store = this.ctx.state; // update state after successful execution('local-state', 'global-state'..)
  }
}
