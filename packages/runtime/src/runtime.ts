/* eslint sonarjs/no-duplicate-string: 0 */
/* eslint sonarjs/no-small-switch: 0 */
import algosdk, { AssetDef, AssetHolding, decodeAddress, makeAssetTransferTxnWithSuggestedParams } from "algosdk";
import cloneDeep from "lodash/cloneDeep";

import { StoreAccount } from "./account";
import { Ctx } from "./ctx";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { Interpreter, loadASAFile } from "./index";
import { convertToString, parseSSCAppArgs } from "./lib/parsing";
import { encodeNote, mkTransaction } from "./lib/txn";
import { LogicSig } from "./logicsig";
import { mockSuggestedParams } from "./mock/tx";
import type {
  AccountAddress, ASADefs,
  ASADeploymentFlags, Context, ExecParams,
  SSCAttributesM, SSCDeploymentFlags, SSCOptionalFlags,
  StackElem, State, StoreAccountI, Txn, TxParams
} from "./types";
import { ExecutionMode, SignType } from "./types";

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
  private assetCounter: number;
  // https://developer.algorand.org/docs/features/transactions/?query=round
  private round: number;
  private timestamp: number;
  private readonly loadedAssetsDefs: ASADefs;

  constructor (accounts: StoreAccountI[]) {
    // runtime store
    this.store = {
      accounts: new Map<AccountAddress, StoreAccountI>(), // string represents account address
      globalApps: new Map<number, AccountAddress>(), // map of {appId: accountAddress}
      assetDefs: new Map<number, AccountAddress>() // number represents assetId
    };

    // intialize accounts (should be done during runtime initialization)
    this.initializeAccounts(accounts);

    // load asa yaml files
    this.loadedAssetsDefs = loadASAFile(this.store.accounts);

    // context for interpreter
    this.ctx = new Ctx(cloneDeep(this.store), <Txn>{}, [], [], this);

    this.appCounter = 0;
    this.assetCounter = 0;
    this.round = 2;
    this.timestamp = 1;
  }

  /**
   * asserts if account is defined.
   * @param a account
   * @param line line number in TEAL file
   * Note: if user is accessing this function directly through runtime,
   * the line number is unknown
   */
  assertAccountDefined (address: string, a?: StoreAccountI, line?: number): StoreAccountI {
    const lineNumber = line ?? 'unknown';
    if (a === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST,
        { address: address, line: lineNumber });
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
    const lineNumber = line ?? 'unknown';
    if (addr === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST,
        { address: addr, line: lineNumber });
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
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND,
        { appId: appId, line: lineNumber });
    }
    return app;
  }

  /**
   * asserts if asset exists in state
   * @param assetId asset index
   * @param assetDef asset definitions
   * @param line line number
   * Note: if user is accessing this function directly through runtime,
   * the line number is unknown
   */
  assertAssetDefined (assetId: number, assetDef?: AssetDef, line?: number): AssetDef {
    const lineNumber = line ?? 'unknown';
    if (assetDef === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND,
        { assetId: assetId, line: lineNumber });
    }
    return assetDef;
  }

  /**
   * Asserts if correct transaction parameters are passed
   * @param txnParams Transaction Parameters
   */
  assertAmbiguousTxnParams (txnParams: ExecParams): void {
    if (txnParams.sign === SignType.SecretKey && txnParams.lsig) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INVALID_TRANSACTION_PARAMS);
    }
  }

  /**
   * Validate first and last rounds of transaction using current round
   * @param gtxns transactions
   */
  validateTxRound (gtxns: Txn[]): void {
    // https://developer.algorand.org/docs/features/transactions/#current-round
    for (const txn of gtxns) {
      if (txn.fv >= this.round || txn.lv <= this.round) {
        throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_ROUND,
          { first: txn.fv, last: txn.lv, round: this.round });
      }
    }
  }

  /**
   * set current round with timestamp for a block
   * @param r current round
   * @param timestamp block's timestamp
   */
  setRoundAndTimestamp (r: number, timestamp: number): void {
    this.round = r;
    this.timestamp = timestamp;
  }

  /**
   * Return current round
   */
  getRound (): number {
    return this.round;
  }

  /**
   * Return current timestamp
   */
  getTimestamp (): number {
    return this.timestamp;
  }

  /**
   * Fetches app from `this.store`
   * @param appId Application Index
   */
  getApp (appId: number): SSCAttributesM {
    if (!this.store.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    const accAddress = this.assertAddressDefined(this.store.globalApps.get(appId));
    const account = this.assertAccountDefined(accAddress, this.store.accounts.get(accAddress));
    return this.assertAppDefined(appId, account.getApp(appId));
  }

  /**
   * Fetches account from `this.store`
   * @param address account address
   */
  getAccount (address: string): StoreAccountI {
    const account = this.store.accounts.get(address);
    return this.assertAccountDefined(address, account);
  }

  /**
   * Fetches global state value for key present in creator's global state
   * for given appId, returns undefined otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appId: number, key: Uint8Array | string): StackElem | undefined {
    if (!this.store.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    const accAddress = this.assertAddressDefined(this.store.globalApps.get(appId));
    const account = this.assertAccountDefined(accAddress, this.store.accounts.get(accAddress));
    return account.getGlobalState(appId, key);
  }

  /**
   * Fetches local state for account address and application index
   * @param appId application index
   * @param accountAddr address for which local state needs to be retrieved
   * @param key: key to fetch value of from local state
   */
  getLocalState (appId: number, accountAddr: string, key: Uint8Array | string): StackElem | undefined {
    accountAddr = this.assertAddressDefined(accountAddr);
    const account = this.assertAccountDefined(accountAddr, this.store.accounts.get(accountAddr));
    return account.getLocalState(appId, key);
  }

  /**
   * Returns asset creator account or throws error is it doesn't exist
   * @param Asset Index
   */
  getAssetAccount (assetId: number): StoreAccountI {
    const addr = this.store.assetDefs.get(assetId);
    if (addr === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND, { assetId: assetId });
    }
    return this.assertAccountDefined(addr, this.store.accounts.get(addr));
  }

  /**
   * Returns Asset Definitions
   * @param assetId Asset Index
   */
  getAssetDef (assetId: number): AssetDef {
    const creatorAcc = this.getAssetAccount(assetId);
    const assetDef = creatorAcc.getAssetDef(assetId);
    return this.assertAssetDefined(assetId, assetDef);
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
        const mockParams = mockSuggestedParams(txnParam.payFlags, this.round);
        const tx = mkTransaction(txnParam, mockParams);
        // convert to encoded obj for compatibility
        const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
        encodedTxnObj.txID = tx.txID();
        txns.push(encodedTxnObj);
      }
      return [txns[0], txns]; // by default current txn is the first txn (hence txns[0])
    } else {
      // if not array, then create a single transaction
      const mockParams = mockSuggestedParams(txnParams.payFlags, this.round);
      const tx = mkTransaction(txnParams, mockParams);

      const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
      encodedTxnObj.txID = tx.txID();
      return [encodedTxnObj, [encodedTxnObj]];
    }
  }

  // creates new asset creation transaction object.
  mkAssetCreateTx (
    name: string, flags: ASADeploymentFlags, asaDef: AssetDef): void {
    // this funtion is called only for validation of parameters passed
    algosdk.makeAssetCreateTxnWithSuggestedParams(
      flags.creator.addr,
      encodeNote(flags.note, flags.noteb64),
      asaDef.total,
      asaDef.decimals,
      asaDef["default-frozen"],
      asaDef.manager !== "" ? asaDef.manager : undefined,
      asaDef.reserve !== "" ? asaDef.reserve : undefined,
      asaDef.freeze !== "" ? asaDef.freeze : undefined,
      asaDef.clawback !== "" ? asaDef.clawback : undefined,
      asaDef["unit-name"],
      name,
      asaDef.url,
      asaDef["metadata-hash"],
      mockSuggestedParams(flags, this.round)
    );
  }

  /**
   * Add Asset in Runtime
   * @param name ASA name
   * @param flags ASA Deployment Flags
   */
  addAsset (name: string, flags: ASADeploymentFlags): number {
    const sender = flags.creator;
    const senderAcc = this.assertAccountDefined(sender.addr, this.store.accounts.get(sender.addr));

    // create asset
    const asset = senderAcc.addAsset(++this.assetCounter, name, this.loadedAssetsDefs[name]);
    this.mkAssetCreateTx(name, flags, asset);
    this.store.assetDefs.set(this.assetCounter, sender.addr);

    this.optIntoASA(this.assetCounter, sender.addr, {}); // opt-in for creator
    return this.assetCounter;
  }

  /**
   * Asset Opt-In for account in Runtime
   * @param assetIndex Asset Index
   * @param address Account address to opt-into asset
   * @param flags Transaction Parameters
   */
  optIntoASA (assetIndex: number, address: AccountAddress, flags: TxParams): void {
    const assetDef = this.getAssetDef(assetIndex);
    const creatorAddr = assetDef.creator;
    makeAssetTransferTxnWithSuggestedParams(
      address, address, undefined, undefined, 0, undefined, assetIndex,
      mockSuggestedParams(flags, this.round));

    const assetHolding: AssetHolding = {
      amount: address === creatorAddr ? assetDef.total : 0, // for creator opt-in amount is total assets
      'asset-id': assetIndex,
      creator: creatorAddr,
      'is-frozen': address === creatorAddr ? false : assetDef["default-frozen"]
    };

    const account = this.getAccount(address);
    account.optInToASA(assetIndex, assetHolding);
  }

  /**
   * Returns Asset Holding from an account
   * @param assetIndex Asset Index
   * @param address address of account to get holding from
   */
  getAssetHolding (assetIndex: number, address: AccountAddress): AssetHolding {
    const account = this.assertAccountDefined(address, this.store.accounts.get(address));
    const assetHolding = account.getAssetHolding(assetIndex);
    if (assetHolding === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.ASA_NOT_OPTIN, {
        assetId: assetIndex,
        address: address
      });
    }
    return assetHolding;
  }

  // creates new application transaction object and update context
  addCtxAppCreateTxn (flags: SSCDeploymentFlags, payFlags: TxParams): void {
    const txn = algosdk.makeApplicationCreateTxn(
      flags.sender.addr,
      mockSuggestedParams(payFlags, this.round),
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
      payFlags.rekeyTo);

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
   * @param approvalProgram application approval program
   * @param clearProgram application clear program
   * NOTE - approval and clear program must be the TEAL code as string (not compiled code)
   */
  addApp (
    flags: SSCDeploymentFlags, payFlags: TxParams,
    approvalProgram: string, clearProgram: string
  ): number {
    const sender = flags.sender;
    const senderAcc = this.assertAccountDefined(sender.addr, this.store.accounts.get(sender.addr));

    // create app with id = 0 in globalApps for teal execution
    const app = senderAcc.addApp(0, flags, approvalProgram, clearProgram);
    this.ctx.state.accounts.set(senderAcc.address, senderAcc);
    this.ctx.state.globalApps.set(app.id, senderAcc.address);

    this.addCtxAppCreateTxn(flags, payFlags);
    this.run(approvalProgram, ExecutionMode.STATEFUL); // execute TEAL code with appId = 0

    // create new application in globalApps map
    this.store.globalApps.set(++this.appCounter, senderAcc.address);

    const attributes = this.assertAppDefined(0, senderAcc.createdApps.get(0));
    senderAcc.createdApps.delete(0); // remove zero app from sender's account
    senderAcc.createdApps.set(this.appCounter, attributes);

    return this.appCounter;
  }

  // creates new OptIn transaction object and update context
  addCtxOptInTx (
    senderAddr: string,
    appId: number,
    payFlags: TxParams,
    flags: SSCOptionalFlags): void {
    const txn = algosdk.makeApplicationOptInTxn(
      senderAddr,
      mockSuggestedParams(payFlags, this.round),
      appId,
      parseSSCAppArgs(flags.appArgs),
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      payFlags.rekeyTo);

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
   */
  optInToApp (accountAddr: string, appId: number,
    flags: SSCOptionalFlags, payFlags: TxParams): void {
    const appParams = this.getApp(appId);
    this.addCtxOptInTx(accountAddr, appId, payFlags, flags);
    this.ctx.state = cloneDeep(this.store);
    const account = this.assertAccountDefined(accountAddr, this.ctx.state.accounts.get(accountAddr));
    account.optInToApp(appId, appParams);

    this.run(appParams["approval-program"], ExecutionMode.STATEFUL);
    this.store = this.ctx.state;
  }

  // creates new Update transaction object and update context
  addCtxAppUpdateTx (
    senderAddr: string,
    appId: number,
    payFlags: TxParams,
    flags: SSCOptionalFlags): void {
    const txn = algosdk.makeApplicationUpdateTxn(
      senderAddr,
      mockSuggestedParams(payFlags, this.round),
      appId,
      new Uint8Array(32), // mock approval program
      new Uint8Array(32), // mock clear progam
      parseSSCAppArgs(flags.appArgs),
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      payFlags.rekeyTo);

    const encTx = txn.get_obj_for_encoding();
    encTx.txID = txn.txID();
    this.ctx.tx = encTx;
    this.ctx.gtxs = [encTx];
  }

  /**
   * Update application
   * @param senderAddr sender address
   * @param appId application Id
   * @param approvalProgram new approval program
   * @param clearProgram new clear program
   * @param payFlags Transaction parameters
   * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
   * NOTE - approval and clear program must be the TEAL code as string
   */
  updateApp (
    senderAddr: string,
    appId: number,
    approvalProgram: string,
    clearProgram: string,
    payFlags: TxParams,
    flags: SSCOptionalFlags
  ): void {
    const appParams = this.getApp(appId);
    this.addCtxAppUpdateTx(senderAddr, appId, payFlags, flags);
    this.ctx.state = cloneDeep(this.store);

    this.run(appParams["approval-program"], ExecutionMode.STATEFUL);

    // If successful, Update programs and state
    this.store = this.ctx.state;
    const updatedApp = this.getApp(appId); // get app after updating store
    updatedApp["approval-program"] = approvalProgram;
    updatedApp["clear-state-program"] = clearProgram;
  }

  // verify 'amt' microalgos can be withdrawn from account
  assertMinBalance (amt: number, address: string): void {
    const account = this.getAccount(address);
    if ((account.amount - amt) < account.minBalance) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE, {
        amount: amt,
        address: address
      });
    }
  }

  /**
   * Returns logic signature
   * @param program TEAL code
   * @param args arguments passed
   */
  getLogicSig (program: string, args: Uint8Array[]): LogicSig {
    const lsig = new LogicSig(program, args);
    const acc = new StoreAccount(0, { addr: lsig.address(), sk: new Uint8Array(0) });
    this.store.accounts.set(acc.address, acc);
    return lsig;
  }

  /**
   * validate logic signature and teal logic
   * @param txnParam Transaction Parameters
   */
  validateLsigAndRun (txnParam: ExecParams): void {
    // check if transaction is signed by logic signature,
    // if yes verify signature and run logic
    if (txnParam.lsig === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_NOT_FOUND);
    }
    this.ctx.args = txnParam.lsig.args;

    // signature validation
    const result = txnParam.lsig.verify(decodeAddress(txnParam.fromAccount.addr).publicKey);
    if (!result) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_VALIDATION_FAILED,
        { address: txnParam.fromAccount.addr });
    }
    // logic validation
    const program = convertToString(txnParam.lsig.logic);
    this.run(program, ExecutionMode.STATELESS);
  }

  /**
   * This function executes a transaction based on a smart
   * contract logic and updates state afterwards
   * @param txnParams : Transaction parameters
   * @param program : teal code as a string
   * @param args : external arguments to smart contract
   */
  executeTx (txnParams: ExecParams | ExecParams[]): void {
    const [tx, gtxs] = this.createTxnContext(txnParams); // get current txn and txn group (as encoded obj)
    // validate first and last rounds
    this.validateTxRound(gtxs);

    // initialize context before each execution
    // state is a deep copy of store
    this.ctx = new Ctx(cloneDeep(this.store), tx, gtxs, [], this);

    const txnParameters = Array.isArray(txnParams) ? txnParams : [txnParams];
    // Run TEAL program associated with each transaction and
    // then execute the transaction without interacting with store.
    this.ctx.processTransactions(txnParameters);

    // update store only if all the transactions are passed
    this.store = this.ctx.state;
  }

  /**
   * This function executes TEAL code line by line
   * @param program : teal code as string
   * @param executionMode : execution Mode (Stateless or Stateful)
   * NOTE: Application mode is only supported in TEAL v2
   */
  run (program: string, executionMode: ExecutionMode): void {
    const interpreter = new Interpreter();
    interpreter.execute(program, executionMode, this);
  }
}
