/* eslint sonarjs/no-duplicate-string: 0 */
/* eslint sonarjs/no-small-switch: 0 */
import { parsing, tx as webTx, types } from "@algo-builder/web";
import algosdk, { decodeAddress, modelsv2 } from "algosdk";
import cloneDeep from "lodash.clonedeep";

import { AccountStore, RuntimeAccount } from "./account";
import { Ctx } from "./ctx";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { Interpreter, loadASAFile } from "./index";
import { ALGORAND_ACCOUNT_MIN_BALANCE, ZERO_ADDRESS_STR } from "./lib/constants";
import { convertToString } from "./lib/parsing";
import { LogicSigAccount } from "./logicsig";
import { mockSuggestedParams } from "./mock/tx";
import {
  AccountAddress, AccountStoreI, AppDeploymentFlags, AppOptionalFlags,
  ASADeploymentFlags, ASAInfo, AssetHoldingM, Context,
  ExecutionMode, RuntimeAccountI, SSCAttributesM, SSCInfo, StackElem, State, Txn
} from "./types";

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
  loadedAssetsDefs: types.ASADefs;
  // https://developer.algorand.org/docs/features/transactions/?query=round
  private round: number;
  private timestamp: number;

  constructor (accounts: AccountStoreI[]) {
    // runtime store
    this.store = {
      accounts: new Map<AccountAddress, AccountStoreI>(), // string represents account address
      accountNameAddress: new Map<string, AccountAddress>(),
      globalApps: new Map<number, AccountAddress>(), // map of {appID: accountAddress}
      assetDefs: new Map<number, AccountAddress>(), // number represents assetId
      assetNameInfo: new Map<string, ASAInfo>(),
      appNameInfo: new Map<string, SSCInfo>(),
      appCounter: 0, // initialize app counter with 0
      assetCounter: 0 // initialize asset counter with 0
    };

    // intialize accounts (should be done during runtime initialization)
    this.initializeAccounts(accounts);

    // load asa yaml files
    this.loadedAssetsDefs = loadASAFile(this.store.accountNameAddress);

    // context for interpreter
    this.ctx = new Ctx(cloneDeep(this.store), <Txn>{}, [], [], this);

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
  assertAccountDefined (address: string, a?: AccountStoreI, line?: number): AccountStoreI {
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
   * @param appID application index
   * @param line line number in TEAL file
   * Note: if user is accessing this function directly through runtime,
   * the line number is unknown
   */
  assertAppDefined (appID: number, app?: SSCAttributesM, line?: number): SSCAttributesM {
    const lineNumber = line ?? 'unknown';
    if (app === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND,
        { appID: appID, line: lineNumber });
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
  assertAssetDefined (
    assetId: number, assetDef?: modelsv2.AssetParams, line?: number
  ): modelsv2.AssetParams {
    const lineNumber = line ?? 'unknown';
    if (assetDef === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND,
        { assetId: assetId, line: lineNumber });
    }
    return assetDef;
  }

  /**
   * Validate first and last rounds of transaction using current round
   * @param gtxns transactions
   */
  validateTxRound (gtxns: Txn[]): void {
    // https://developer.algorand.org/docs/features/transactions/#current-round
    for (const txn of gtxns) {
      if (Number(txn.fv) >= this.round || txn.lv <= this.round) {
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
   * @param appID Application Index
   */
  getApp (appID: number): SSCAttributesM {
    if (!this.store.globalApps.has(appID)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appID: appID, line: 'unknown' });
    }
    const accAddress = this.assertAddressDefined(this.store.globalApps.get(appID));
    const account = this.assertAccountDefined(accAddress, this.store.accounts.get(accAddress));
    return this.assertAppDefined(appID, account.getApp(appID));
  }

  /**
   * Fetches account from `this.store`
   * @param address account address
   */
  getAccount (address: string): AccountStoreI {
    const account = this.store.accounts.get(address);
    return this.assertAccountDefined(address, account);
  }

  /**
   * Fetches global state value for key present in creator's global state
   * for given appID, returns undefined otherwise
   * @param appID: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appID: number, key: Uint8Array | string): StackElem | undefined {
    if (!this.store.globalApps.has(appID)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appID: appID, line: 'unknown' });
    }
    const accAddress = this.assertAddressDefined(this.store.globalApps.get(appID));
    const account = this.assertAccountDefined(accAddress, this.store.accounts.get(accAddress));
    return account.getGlobalState(appID, key);
  }

  /**
   * Fetches local state for account address and application index
   * @param appID application index
   * @param accountAddr address for which local state needs to be retrieved
   * @param key: key to fetch value of from local state
   */
  getLocalState (appID: number, accountAddr: string, key: Uint8Array | string): StackElem | undefined {
    accountAddr = this.assertAddressDefined(accountAddr);
    const account = this.assertAccountDefined(accountAddr, this.store.accounts.get(accountAddr));
    return account.getLocalState(appID, key);
  }

  /**
   * Returns asset creator account or throws error is it doesn't exist
   * @param Asset Index
   */
  getAssetAccount (assetId: number): AccountStoreI {
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
  getAssetDef (assetId: number): modelsv2.AssetParams {
    const creatorAcc = this.getAssetAccount(assetId);
    const assetDef = creatorAcc.getAssetDef(assetId);
    return this.assertAssetDefined(assetId, assetDef);
  }

  /**
   * Queries asset id by asset name from global state.
   * Returns undefined if asset is not found.
   * @param name Asset name
   */
  getAssetInfoFromName (name: string): ASAInfo | undefined {
    return this.store.assetNameInfo.get(name);
  }

  /**
   * Queries app id by app name from global state.
   * Returns undefined if app is not found.
   * https://www.pivotaltracker.com/story/show/180142720
   * @param approval
   * @param clear
   */
  getAppInfoFromName (approval: string, clear: string): SSCInfo | undefined {
    return this.store.appNameInfo.get(approval + "-" + clear);
  }

  /**
   * Setup initial accounts as {address: SDKAccount}. This should be called only when initializing Runtime.
   * @param accounts: array of account info's
   */
  initializeAccounts (accounts: AccountStoreI[]): void {
    for (const acc of accounts) {
      if (acc.account.name) this.store.accountNameAddress.set(acc.account.name, acc.account.addr);
      this.store.accounts.set(acc.address, acc);

      for (const appID of acc.createdApps.keys()) {
        this.store.globalApps.set(appID, acc.address);
      }

      for (const assetId of acc.createdAssets.keys()) {
        this.store.assetDefs.set(assetId, acc.address);
      }
    }

    // add fee sink (fees + rewards collected are accumulated in this account)
    const feeSink = new AccountStore(
      ALGORAND_ACCOUNT_MIN_BALANCE,
      new RuntimeAccount({ addr: ZERO_ADDRESS_STR, sk: new Uint8Array(0) })
    );
    this.store.accounts.set(feeSink.address, feeSink);
  }

  /**
   * Creates new transaction object (tx, gtxs) from given txnParams
   * @param txnParams : Transaction parameters for current txn or txn Group
   * @returns: [current transaction, transaction group]
   */
  createTxnContext (txnParams: types.ExecParams | types.ExecParams[]): [Txn, Txn[]] {
    // if txnParams is array, then user is requesting for a group txn
    if (Array.isArray(txnParams)) {
      if (txnParams.length > 16) {
        throw new Error("Maximum size of an atomic transfer group is 16");
      }

      const txns = [];
      for (const txnParam of txnParams) { // create encoded_obj for each txn in group
        const mockParams = mockSuggestedParams(txnParam.payFlags, this.round);
        const tx = webTx.mkTransaction(txnParam, mockParams);
        // convert to encoded obj for compatibility
        const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
        encodedTxnObj.txID = tx.txID();
        txns.push(encodedTxnObj);
      }
      return [txns[0], txns]; // by default current txn is the first txn (hence txns[0])
    } else {
      // if not array, then create a single transaction
      const mockParams = mockSuggestedParams(txnParams.payFlags, this.round);
      const tx = webTx.mkTransaction(txnParams, mockParams);

      const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
      encodedTxnObj.txID = tx.txID();
      return [encodedTxnObj, [encodedTxnObj]];
    }
  }

  // creates new asset creation transaction object.
  mkAssetCreateTx (
    name: string, flags: ASADeploymentFlags, asaDef: modelsv2.AssetParams): void {
    // this funtion is called only for validation of parameters passed
    algosdk.makeAssetCreateTxnWithSuggestedParams(
      flags.creator.addr,
      webTx.encodeNote(flags.note, flags.noteb64),
      asaDef.total,
      Number(asaDef.decimals),
      asaDef.defaultFrozen ? asaDef.defaultFrozen : false,
      asaDef.manager !== "" ? asaDef.manager : undefined,
      asaDef.reserve !== "" ? asaDef.reserve : undefined,
      asaDef.freeze !== "" ? asaDef.freeze : undefined,
      asaDef.clawback !== "" ? asaDef.clawback : undefined,
      asaDef.unitName as string,
      name,
      asaDef.url as string,
      typeof asaDef.metadataHash !== "undefined" && typeof asaDef.metadataHash !== 'string'
        ? Buffer.from(asaDef.metadataHash).toString('base64')
        : asaDef.metadataHash,
      mockSuggestedParams(flags, this.round)
    );
  }

  /**
   * Add Asset in Runtime using asa.yaml
   * @param name ASA name
   * @param flags ASA Deployment Flags
   */
  addAsset (asa: string, flags: ASADeploymentFlags): number {
    this.ctx.addAsset(asa, flags.creator.addr, flags);
    this.store = this.ctx.state;

    this.optInToASAMultiple(this.store.assetCounter, this.loadedAssetsDefs[asa].optInAccNames);
    return this.store.assetCounter;
  }

  /**
   * Add Asset in Runtime without using asa.yaml
   * @param name ASA name
   * @param flags ASA Deployment Flags
   */
  addASADef (asa: string, asaDef: types.ASADef, flags: ASADeploymentFlags): number {
    this.ctx.addASADef(asa, asaDef, flags.creator.addr, flags);
    this.store = this.ctx.state;

    this.optInToASAMultiple(this.store.assetCounter, asaDef.optInAccNames);
    return this.store.assetCounter;
  }

  /**
   * Opt-In to all accounts given in asa.yaml to a specific asset.
   * @param name Asset name
   * @param assetID Asset Index
   */
  optInToASAMultiple (assetID: number, accounts?: string[]): void {
    if (accounts === undefined) {
      return;
    }
    for (const accName of accounts) {
      const address = this.store.accountNameAddress.get(accName);
      if (address) {
        this.optIntoASA(assetID, address, {});
      }
    }
  }

  /**
   * Asset Opt-In for account in Runtime
   * @param assetIndex Asset Index
   * @param address Account address to opt-into asset
   * @param flags Transaction Parameters
   */
  optIntoASA (assetIndex: number, address: AccountAddress, flags: types.TxParams): void {
    this.ctx.optIntoASA(assetIndex, address, flags);

    this.store = this.ctx.state;
  }

  /**
   * Returns Asset Holding from an account
   * @param assetIndex Asset Index
   * @param address address of account to get holding from
   */
  getAssetHolding (assetIndex: number, address: AccountAddress): AssetHoldingM {
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
  addCtxAppCreateTxn (flags: AppDeploymentFlags, payFlags: types.TxParams): void {
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
      parsing.parseAppArgs(flags.appArgs),
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      payFlags.rekeyTo);

    const encTx = { ...txn.get_obj_for_encoding(), txID: txn.txID() };
    this.ctx.tx = encTx;
    this.ctx.gtxs = [encTx];
  }

  /**
   * creates new application and returns application id
   * @param flags SSCDeployment flags
   * @param payFlags Transaction parameters
   * @param approvalProgram application approval program
   * @param clearProgram application clear program
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   * NOTE - approval and clear program must be the TEAL code as string (not compiled code)
   */
  addApp (
    flags: AppDeploymentFlags, payFlags: types.TxParams,
    approvalProgram: string, clearProgram: string,
    debugStack?: number
  ): number {
    this.addCtxAppCreateTxn(flags, payFlags);
    this.ctx.debugStack = debugStack;
    this.ctx.addApp(flags.sender.addr, flags, approvalProgram, clearProgram, 0);

    this.store = this.ctx.state;
    return this.store.appCounter;
  }

  // creates new OptIn transaction object and update context
  addCtxOptInTx (
    senderAddr: string,
    appID: number,
    payFlags: types.TxParams,
    flags: AppOptionalFlags): void {
    const txn = algosdk.makeApplicationOptInTxn(
      senderAddr,
      mockSuggestedParams(payFlags, this.round),
      appID,
      parsing.parseAppArgs(flags.appArgs),
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      payFlags.rekeyTo);

    const encTx = { ...txn.get_obj_for_encoding(), txID: txn.txID() };
    this.ctx.tx = encTx;
    this.ctx.gtxs = [encTx];
  }

  /**
   * Account address opt-in for application Id
   * @param accountAddr Account address
   * @param appID Application Id
   * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
   * @param payFlags Transaction Parameters
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   */
  optInToApp (accountAddr: string, appID: number,
    flags: AppOptionalFlags, payFlags: types.TxParams, debugStack?: number): void {
    this.addCtxOptInTx(accountAddr, appID, payFlags, flags);
    this.ctx.debugStack = debugStack;
    this.ctx.optInToApp(accountAddr, appID, 0);

    this.store = this.ctx.state;
  }

  // creates new Update transaction object and update context
  addCtxAppUpdateTx (
    senderAddr: string,
    appID: number,
    payFlags: types.TxParams,
    flags: AppOptionalFlags): void {
    const txn = algosdk.makeApplicationUpdateTxn(
      senderAddr,
      mockSuggestedParams(payFlags, this.round),
      appID,
      new Uint8Array(32), // mock approval program
      new Uint8Array(32), // mock clear progam
      parsing.parseAppArgs(flags.appArgs),
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      payFlags.rekeyTo);

    const encTx = { ...txn.get_obj_for_encoding(), txID: txn.txID() };
    this.ctx.tx = encTx;
    this.ctx.gtxs = [encTx];
  }

  /**
   * Update application
   * @param senderAddr sender address
   * @param appID application Id
   * @param approvalProgram new approval program
   * @param clearProgram new clear program
   * @param payFlags Transaction parameters
   * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   * NOTE - approval and clear program must be the TEAL code as string
   */
  updateApp (
    senderAddr: string,
    appID: number,
    approvalProgram: string,
    clearProgram: string,
    payFlags: types.TxParams,
    flags: AppOptionalFlags,
    debugStack?: number
  ): void {
    this.addCtxAppUpdateTx(senderAddr, appID, payFlags, flags);
    this.ctx.debugStack = debugStack;
    this.ctx.updateApp(appID, approvalProgram, clearProgram, 0);

    // If successful, Update programs and state
    this.store = this.ctx.state;
  }

  // verify 'amt' microalgos can be withdrawn from account
  assertMinBalance (amt: bigint, address: string): void {
    const account = this.getAccount(address);
    if ((account.amount - amt) < account.minBalance) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE, {
        amount: amt,
        address: address
      });
    }
  }

  /**
   * Validate signature for Algorand account on transaction params.
   * Include check spending account when creating a transaction from Algorand account
   * Throw RuntimeError if signature is invalid.
   * @param txParam transaction parameters.
   */
  validateAccountSignature (txParam: types.ExecParams): void {
    const fromAccountAddr = webTx.getFromAddress(txParam);
    const from = this.getAccount(fromAccountAddr);
    const signAccount = txParam.fromAccount;

    if (signAccount) {
      // if spend account of fromAccountAddr is different with signAccount
      // then throw error.
      if (!from.account.getSpend().equal(signAccount)) {
        throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT);
      }
    } else {
      // throw error if your don't provide account `signature`.
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_SECRET_KEY);
    }
  }

  /**
   * Creates a new account with logic signature and smart contract arguments
   * in the runtime store. The arguments are used when we send a transaction with this
   * account and verify it.
   * @param program TEAL code
   * @param args arguments passed
   * @returns logic signature with arguments.
   */
  createLsigAccount (program: string, args: Uint8Array[]): LogicSigAccount {
    if (program === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_PROGRAM);
    }
    const lsig = new LogicSigAccount(program, args);

    const acc = new AccountStore(
      0,
      new RuntimeAccount({ addr: lsig.address(), sk: new Uint8Array(0) })
    );

    this.store.accounts.set(acc.address, acc);
    return lsig;
  }

  /**
   * Transfers `amount` of microAlgos from `from` address to `to` address
   * @param from From account
   * @param to to address
   * @param amount amount of algo in microalgos
   */
  fundLsig (from: RuntimeAccountI, to: AccountAddress, amount: number): void {
    const fundParam: types.ExecParams = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: from,
      toAccountAddr: to,
      amountMicroAlgos: amount,
      payFlags: { totalFee: 1000 }
    };
    this.executeTx(fundParam);
  }

  /**
   * validate logic signature and teal logic
   * @param txnParam Transaction Parameters
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   */
  validateLsigAndRun (txnParam: types.ExecParams, debugStack?: number): void {
    // check if transaction is signed by logic signature,
    // if yes verify signature and run logic
    if (txnParam.sign === types.SignType.LogicSignature && txnParam.lsig) {
      this.ctx.args = txnParam.args ?? txnParam.lsig.lsig.args;

      // signature validation
      const fromAccountAddr = webTx.getFromAddress(txnParam);
      const result = txnParam.lsig.lsig.verify(decodeAddress(fromAccountAddr).publicKey);
      if (!result) {
        throw new RuntimeError(RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_VALIDATION_FAILED,
          { address: fromAccountAddr });
      }
      // logic validation
      const program = convertToString(txnParam.lsig.lsig.logic);
      if (program === "") {
        throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_PROGRAM);
      }
      this.run(program, ExecutionMode.SIGNATURE, 0, debugStack);
    } else {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_NOT_FOUND);
    }
  }

  /**
   * This function executes a transaction based on a smart
   * contract logic and updates state afterwards
   * @param txnParams : Transaction parameters
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   */
  executeTx (txnParams: types.ExecParams | types.ExecParams[], debugStack?: number): void {
    const txnParameters = Array.isArray(txnParams) ? txnParams : [txnParams];
    for (const txn of txnParameters) {
      switch (txn.type) {
        case types.TransactionType.DeployASA: {
          if (txn.asaDef === undefined) txn.asaDef = this.loadedAssetsDefs[txn.asaName];
          break;
        }
        case types.TransactionType.DeployApp: {
          txn.approvalProg = new Uint8Array(32); // mock approval program
          txn.clearProg = new Uint8Array(32); // mock clear program
          break;
        }
      }
    }
    const [tx, gtxs] = this.createTxnContext(txnParameters); // get current txn and txn group (as encoded obj)
    // validate first and last rounds
    this.validateTxRound(gtxs);

    // initialize context before each execution
    // Prepare shared space at each execution of transaction/s.
    // state is a deep copy of store
    this.ctx = new Ctx(cloneDeep(this.store), tx, gtxs, [], this, debugStack);

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
   * @param debugStack: if passed then TEAL Stack is logged to console after
   * each opcode execution (upto depth = debugStack)
   * NOTE: Application mode is only supported in TEALv > 1
   */
  run (program: string, executionMode: ExecutionMode, indexInGroup: number, debugStack?: number): void {
    const interpreter = new Interpreter();
    interpreter.execute(program, executionMode, this, debugStack);
    // reset pooled opcode cost for single tx, this is to handle singular functions
    // which don't "initialize" a new ctx (eg. addApp)
    if (this.ctx.gtxs.length === 1) { this.ctx.pooledApplCost = 0; }
    if (executionMode === ExecutionMode.APPLICATION) {
      this.ctx.sharedScratchSpace.set(indexInGroup, interpreter.scratch);
    }
  }
}
