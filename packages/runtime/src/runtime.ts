import { parsing, tx as webTx, types } from "@algo-builder/web";
import algosdk, {
	Account as AccountSDK,
	decodeAddress,
	decodeSignedTransaction,
	modelsv2,
	SignedTransaction,
} from "algosdk";
import cloneDeep from "lodash.clonedeep";

import { AccountStore, defaultSDKAccounts, RuntimeAccount } from "./account";
import { Ctx } from "./ctx";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { getProgram, Interpreter, loadASAFile } from "./index";
import {
	ALGORAND_ACCOUNT_MIN_BALANCE,
	ALGORAND_MAX_TX_ARRAY_LEN,
	MAX_APP_PROGRAM_COST,
	TransactionTypeEnum,
	ZERO_ADDRESS_STR,
} from "./lib/constants";
import { convertToString } from "./lib/parsing";
import { LogicSigAccount } from "./logicsig";
import { mockSuggestedParams } from "./mock/tx";
import {
	AccountAddress,
	AccountStoreI,
	AppInfo,
	AppOptionalFlags,
	ASADeploymentFlags,
	ASAInfo,
	AssetHoldingM,
	Context,
	EncTx,
	ExecutionMode,
	RuntimeAccountI,
	SCParams,
	SSCAttributesM,
	StackElem,
	State,
	TxReceipt,
} from "./types";
// const nacl = require('algosdk/dist/cjs/src/nacl/naclWrappers');

export class Runtime {
	/**
	 * We are using Maps instead of algosdk arrays
	 * because of faster and easy querying.
	 * This way when querying, instead of traversing the whole object,
	 * we can get the value directly from Map
	 * Note: Runtime operates on `store`, it doesn't operate on `ctx`.
	 */
	private store: State;
	private _defaultAccounts: AccountStore[];
	ctx: Context;
	parentCtx?: Context; // parent Ctx call to current inner Txns;
	loadedAssetsDefs: types.ASADefs;
	// https://developer.algorand.org/docs/features/transactions/?query=round
	private round: number;
	private timestamp: number;

	constructor(accounts: AccountStoreI[]) {
		// runtime store
		this.store = {
			accounts: new Map<AccountAddress, AccountStoreI>(), // string represents account address
			accountNameAddress: new Map<string, AccountAddress>(),
			globalApps: new Map<number, AccountAddress>(), // map of {appID: accountAddress}
			assetDefs: new Map<number, AccountAddress>(), // number represents assetId
			assetNameInfo: new Map<string, ASAInfo>(),
			appNameMap: new Map<string, AppInfo>(),
			appCounter: ALGORAND_MAX_TX_ARRAY_LEN, // initialize app counter with 8
			assetCounter: ALGORAND_MAX_TX_ARRAY_LEN, // initialize asset counter with 8
			txReceipts: new Map<string, TxReceipt>(), // receipt of each transaction, i.e map of {txID: txReceipt}
		};

		this._defaultAccounts = this._setupDefaultAccounts();

		// intialize accounts (should be done during runtime initialization)
		this.initializeAccounts(accounts);

		// load asa yaml files
		this.loadedAssetsDefs = loadASAFile(this.store.accountNameAddress);

		// context for interpreter
		this.ctx = new Ctx(cloneDeep(this.store), <EncTx>{}, [], [], this);
		this.round = 2;
		this.timestamp = 1;
	}

	get defaultBalance(): number {
		return 100 * 1e6; // 100 Algos
	}

	/**
	 * Returns a list of initialized default accounts created using static accountSDK from account.ts
	 *  and funded with default balance (100 ALGO)
	 * @returns list of AccountStore
	 */
	_setupDefaultAccounts(): AccountStore[] {
		const balance = this.defaultBalance;
		const accounts = Object.values(defaultSDKAccounts).map(
			(accountInfo) => new AccountStore(balance, accountInfo)
		);
		this.initializeAccounts(accounts);
		return accounts;
	}

	/**
	 * Resets the state of the default accounts
	 */
	resetDefaultAccounts(): void {
		this._defaultAccounts = this._setupDefaultAccounts();
	}

	/**
	 * Getter for _defaultAccounts, returns a synced version of the accounts list
	 * @returns list of AccountStore
	 */
	defaultAccounts(): AccountStore[] {
		return this._defaultAccounts.map((account) => this.getAccount(account.address));
	}

	/**
	 * Returns transaction receipt for a particular transaction
	 * @param txID transaction ID
	 */
	getTxReceipt(txID: string): TxReceipt | undefined {
		return this.store.txReceipts.get(txID);
	}

	/**
	 * asserts if account is defined.
	 * @param address address
	 * @param a account
	 * @param line line number in TEAL file
	 * Note: if user is accessing this function directly through runtime,
	 * the line number is unknown
	 */
	assertAccountDefined(address: string, a?: AccountStoreI, line?: number): AccountStoreI {
		const lineNumber = line ?? "unknown";
		if (a === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST, {
				address: address,
				line: lineNumber,
			});
		}
		if (a.address !== address) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_ADDR_MISMATCH, {
				address: address,
				line: lineNumber,
			});
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
	assertAddressDefined(addr: string | undefined, line?: number): string {
		const lineNumber = line ?? "unknown";
		if (addr === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST, {
				address: addr,
				line: lineNumber,
			});
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
	assertAppDefined(appID: number, app?: SSCAttributesM, line?: number): SSCAttributesM {
		const lineNumber = line ?? "unknown";
		if (app === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: lineNumber,
			});
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
	assertAssetDefined(
		assetId: number,
		assetDef?: modelsv2.AssetParams,
		line?: number
	): modelsv2.AssetParams {
		const lineNumber = line ?? "unknown";
		if (assetDef === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND, {
				assetId: assetId,
				line: lineNumber,
			});
		}
		return assetDef;
	}

	/**
	 * Validate first and last rounds of transaction using current round
	 * @param gtxns transactions
	 */
	validateTxRound(gtxns: EncTx[]): void {
		// https://developer.algorand.org/docs/features/transactions/#current-round
		for (const txn of gtxns) {
			if (Number(txn.fv) >= this.round || txn.lv <= this.round) {
				throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_ROUND, {
					first: txn.fv,
					last: txn.lv,
					round: this.round,
				});
			}
		}
	}

	/**
	 * Ensure no duplicate transaction in group txn
	 * @param gtxns group transaction
	 */
	assertNoDuplicateTransaction(gtxns: EncTx[]): void {
		for (const txn of gtxns) {
			const isDuplicate = gtxns.filter((anotherTxn) => anotherTxn.txID === txn.txID).length > 1;
			if (isDuplicate) {
				throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.TRANSACTION_ALREADY_IN_LEDGER);
			}
		}
	}

	/**
	 * set current round with timestamp for a block
	 * @param r current round
	 * @param timestamp block's timestamp
	 */
	setRoundAndTimestamp(r: number, timestamp: number): void {
		this.round = r;
		this.timestamp = timestamp;
	}

	/**
	 * Return current round
	 */
	getRound(): number {
		return this.round;
	}

	/**
	 * Return current timestamp
	 */
	getTimestamp(): number {
		return this.timestamp;
	}

	/**
	 * Fetches app from `this.store`
	 * @param appID Application Index
	 */
	getApp(appID: number): SSCAttributesM {
		if (!this.store.globalApps.has(appID)) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: "unknown",
			});
		}
		const accAddress = this.assertAddressDefined(this.store.globalApps.get(appID));
		const account = this.assertAccountDefined(accAddress, this.store.accounts.get(accAddress));
		return this.assertAppDefined(appID, account.getApp(appID));
	}

	/**
	 * Fetches account from `this.store`
	 * @param address account address
	 */
	getAccount(address: string): AccountStoreI {
		const account = this.store.accounts.get(address);
		return this.assertAccountDefined(address, account);
	}

	/**
	 * Fetches global state value for key present in creator's global state
	 * for given appID, returns undefined otherwise
	 * @param appID: current application id
	 * @param key: key to fetch value of from local state
	 */
	getGlobalState(appID: number, key: Uint8Array | string): StackElem | undefined {
		if (!this.store.globalApps.has(appID)) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: "unknown",
			});
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
	getLocalState(
		appID: number,
		accountAddr: string,
		key: Uint8Array | string
	): StackElem | undefined {
		accountAddr = this.assertAddressDefined(accountAddr);
		const account = this.assertAccountDefined(
			accountAddr,
			this.store.accounts.get(accountAddr)
		);
		return account.getLocalState(appID, key);
	}

	/**
	 * Returns asset creator account or throws error is it doesn't exist
	 * @param assetId Index
	 */
	getAssetAccount(assetId: number): AccountStoreI {
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
	getAssetDef(assetId: number): modelsv2.AssetParams {
		const creatorAcc = this.getAssetAccount(assetId);
		const assetDef = creatorAcc.getAssetDef(assetId);
		return this.assertAssetDefined(assetId, assetDef);
	}

	/**
	 * Queries asset id by asset name from global state.
	 * Returns undefined if asset is not found.
	 * @param name Asset name
	 */
	getAssetInfoFromName(name: string): ASAInfo | undefined {
		return this.store.assetNameInfo.get(name);
	}

	/**
	 * Queries app id by app name from global state.
	 * Returns undefined if app is not found.
	 * https://www.pivotaltracker.com/story/show/180142720
	 * @param approval
	 * @param clear
	 */
	getAppInfoFromName(approval: string, clear: string): AppInfo | undefined {
		return this.store.appNameMap.get(approval + "-" + clear);
	}

	/**
	 * Queries app id by app name from global state.
	 * Returns undefined if app is not found.
	 * @param appName
	 */
	getAppByName(appName: string): AppInfo | undefined {
		return this.store.appNameMap.get(appName);
	}

	/**
	 * Setup initial accounts as {address: SDKAccount}. This should be called only when initializing Runtime.
	 * @param accounts: array of account info's
	 */
	initializeAccounts(accounts: AccountStoreI[]): void {
		for (const acc of accounts) {
			if (acc.account.name)
				this.store.accountNameAddress.set(acc.account.name, acc.account.addr);
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
	 * Creates new transaction object (tx, gtxs) from given txnParams and signes it
	 * @param txnParams : Transaction parameters for current txn or txn Group
	 * @returns: [current SignedTransaction, SignedTransaction group]
	 */
	/* eslint-disable sonarjs/cognitive-complexity */
	createTxnContext(txnParams: types.ExecParams[]): [SignedTransaction, SignedTransaction[]] {
		// if txnParams is array, then user is requesting for a group txn
		let signedTx: SignedTransaction;
		if (txnParams.length === 0) {
			throw new Error("ExecParams length is zero");
		}
		if (txnParams.length > 16) {
			throw new Error("Maximum size of an atomic transfer group is 16");
		}

		const txns = [];
		for (const txnParam of txnParams) {
			const mockParams = mockSuggestedParams(txnParam.payFlags, this.round);
			const tx = webTx.mkTransaction(txnParam, mockParams);
			if (txnParam.sign === types.SignType.SecretKey) {
				if (txnParam.fromAccount.sk.length !== 64) {
					throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_SECRET_KEY, {
						secretkey: txnParam.fromAccount.sk,
					});
				}
				signedTx = decodeSignedTransaction(tx.signTxn(txnParam.fromAccount.sk));
				signedTx = { sig: signedTx.sig, sgnr: signedTx.sgnr, txn: tx };
			} else {
				//in case of lsig we do not sign it we just mock the signature
				signedTx = { sig: Buffer.alloc(5), txn: tx };
			}
			txns.push(signedTx);
		}
		return [txns[0], txns]; // by default current txn is the first txn (hence txns[0])
	}
	/* eslint-enable sonarjs/cognitive-complexity */

	/**
	 * Creates new asset creation transaction object.
	 * @param name : asset name
	 * @param flags: asa deployment flags
	 * @param asaDef: asa definition
	 */
	mkAssetCreateTx(name: string, flags: ASADeploymentFlags, asaDef: modelsv2.AssetParams): void {
		// this funtion is called only for validation of parameters passed
		const txn = algosdk.makeAssetCreateTxnWithSuggestedParams(
			flags.creator.addr,
			webTx.encodeNote(flags.note, flags.noteb64),
			asaDef.total,
			Number(asaDef.decimals),
			asaDef.defaultFrozen ? asaDef.defaultFrozen : false,
			asaDef.manager !== "" ? asaDef.manager : undefined,
			asaDef.reserve !== "" ? asaDef.reserve : undefined,
			asaDef.freeze !== "" ? asaDef.freeze : undefined,
			asaDef.clawback !== "" ? asaDef.clawback : undefined,
			asaDef.unitName,
			name,
			asaDef.url,
			typeof asaDef.metadataHash !== "undefined" && typeof asaDef.metadataHash !== "string"
				? Buffer.from(asaDef.metadataHash).toString("base64")
				: asaDef.metadataHash,
			mockSuggestedParams(flags, this.round)
		);

		if (this.ctx.tx === undefined || this.ctx.tx.type !== TransactionTypeEnum.ASSET_CONFIG) {
			// could already be defined (if used as a txGroup in this.executeTx())
			const encTx = { ...txn.get_obj_for_encoding(), txID: txn.txID() };
			this.ctx.tx = encTx;
			this.ctx.gtxs = [encTx];
		}
	}

	/**
	 * Deploy Asset in Runtime using asa.yaml
	 * @param asa ASA name
	 * @param flags ASA Deployment Flags
	 */
	deployASA(asa: string, flags: ASADeploymentFlags): ASAInfo {
		const txReceipt = this.ctx.deployASA(asa, flags.creator.addr, flags);
		this.store = this.ctx.state;

		this.optInToASAMultiple(this.store.assetCounter, this.loadedAssetsDefs[asa].optInAccNames);
		return txReceipt;
	}

	/**
	 * Deploy Asset in Runtime without using asa.yaml
	 * @param asa ASA name
	 * @param flags ASA Deployment Flags
	 */
	deployASADef(asa: string, asaDef: types.ASADef, flags: ASADeploymentFlags): ASAInfo {
		const txReceipt = this.ctx.deployASADef(asa, asaDef, flags.creator.addr, flags);
		this.store = this.ctx.state;

		this.optInToASAMultiple(this.store.assetCounter, asaDef.optInAccNames);
		return txReceipt;
	}

	/**
	 * Opt-In to all accounts given in asa.yaml to a specific asset.
	 * @param assetID Asset Index
	 * @param accounts list account opt to asa
	 */
	optInToASAMultiple(assetID: number, accounts?: string[]): void {
		if (accounts === undefined) {
			return;
		}
		for (const accName of accounts) {
			const address = this.store.accountNameAddress.get(accName);
			if (address) {
				this.optInToASA(assetID, address, {});
			}
		}
	}

	/**
	 * Asset Opt-In for account in Runtime
	 * @param assetIndex Asset Index
	 * @param address Account address to opt-into asset
	 * @param flags Transaction Parameters
	 */
	optInToASA(assetIndex: number, address: AccountAddress, flags: types.TxParams): TxReceipt {
		const txReceipt = this.ctx.optInToASA(assetIndex, address, flags);

		this.store = this.ctx.state;
		return txReceipt;
	}

	/**
	 * Returns Asset Holding from an account
	 * @param assetIndex Asset Index
	 * @param address address of account to get holding from
	 */
	getAssetHolding(assetIndex: number, address: AccountAddress): AssetHoldingM {
		const account = this.assertAccountDefined(address, this.store.accounts.get(address));
		const assetHolding = account.getAssetHolding(assetIndex);
		if (assetHolding === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.ASA_NOT_OPTIN, {
				assetId: assetIndex,
				address: address,
			});
		}
		return assetHolding;
	}

	// creates new application transaction object and update context
	addCtxAppCreateTxn(
		creator: AccountSDK,
		appDef: types.AppDefinition,
		payFlags: types.TxParams
	): void {
		const txn = algosdk.makeApplicationCreateTxn(
			creator.addr,
			mockSuggestedParams(payFlags, this.round),
			algosdk.OnApplicationComplete.NoOpOC,
			new Uint8Array(32), // mock approval program
			new Uint8Array(32), // mock clear progam
			appDef.localInts,
			appDef.localBytes,
			appDef.globalInts,
			appDef.globalBytes,
			parsing.parseAppArgs(appDef.appArgs),
			appDef.accounts,
			appDef.foreignApps,
			appDef.foreignAssets,
			appDef.note,
			appDef.lease,
			payFlags.rekeyTo
		);

		const encTx = { ...txn.get_obj_for_encoding(), txID: txn.txID() };
		this.ctx.tx = encTx;
		this.ctx.gtxs = [encTx];
	}

	/**
	 * deploy a new application and returns application id
	 * @param payFlags Transaction parameters
	 * @param appDefinition app definition
	 * @param scTmplParams Smart Contract template parameters
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	deployApp(
		sender: AccountSDK,
		appDefinition: types.AppDefinition,
		payFlags: types.TxParams,
		scTmplParams?: SCParams,
		debugStack?: number
	): AppInfo {
		this.addCtxAppCreateTxn(sender, appDefinition, payFlags);
		this.ctx.debugStack = debugStack;
		this.ctx.budget = MAX_APP_PROGRAM_COST;
		const txReceipt = this.ctx.deployApp(sender.addr, appDefinition, 0, scTmplParams);
		this.store = this.ctx.state;
		return txReceipt;
	}

	// creates new OptIn transaction object and update context
	addCtxOptInTx(
		senderAddr: string,
		appID: number,
		payFlags: types.TxParams,
		flags: AppOptionalFlags
	): void {
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
			payFlags.rekeyTo
		);

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
	optInToApp(
		accountAddr: string,
		appID: number,
		flags: AppOptionalFlags,
		payFlags: types.TxParams,
		debugStack?: number
	): TxReceipt {
		this.addCtxOptInTx(accountAddr, appID, payFlags, flags);
		this.ctx.debugStack = debugStack;
		this.ctx.budget = MAX_APP_PROGRAM_COST;
		const txReceipt = this.ctx.optInToApp(accountAddr, appID, 0);

		this.store = this.ctx.state;
		return txReceipt;
	}

	// creates new Update transaction object and update context
	addCtxAppUpdateTx(
		senderAddr: string,
		appID: number,
		payFlags: types.TxParams,
		flags: AppOptionalFlags
	): void {
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
			payFlags.rekeyTo
		);

		const encTx = { ...txn.get_obj_for_encoding(), txID: txn.txID() };
		this.ctx.tx = encTx;
		this.ctx.gtxs = [encTx];
	}

	/**
	 * Update application
	 * @param appName application Name. Note in runtime application name just placeholder params
	 * @param senderAddr sender address
	 * @param appID application Id
	 * @param newAppCode new application source code
	 * @param payFlags Transaction parameters
	 * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	updateApp(
		appName: string,
		senderAddr: string,
		appID: number,
		newAppCode: types.SmartContract,
		payFlags: types.TxParams,
		flags: AppOptionalFlags,
		scTmplParams?: SCParams,
		debugStack?: number
	): TxReceipt {
		this.addCtxAppUpdateTx(senderAddr, appID, payFlags, flags);
		this.ctx.debugStack = debugStack;
		this.ctx.budget = MAX_APP_PROGRAM_COST;
		const txReceipt = this.ctx.updateApp(appID, newAppCode, 0, scTmplParams);

		// If successful, Update programs and state
		this.store = this.ctx.state;
		return txReceipt;
	}

	// verify 'amt' microalgos can be withdrawn from account
	assertMinBalance(amt: bigint, address: string): void {
		const account = this.getAccount(address);
		if (account.amount - amt < account.minBalance) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE, {
				amount: amt,
				address: address,
			});
		}
	}

	/**
	 * Validate signature for Algorand account on transaction params.
	 * Include check spending account when creating a transaction from Algorand account
	 * Throw RuntimeError if signature is invalid.
	 * @param txParam transaction parameters.
	 */
	validateAccountSignature(txParam: types.ExecParams): void {
		const fromAccountAddr = webTx.getFromAddress(txParam);
		const from = this.getAccount(fromAccountAddr);
		const signerAccount = txParam.fromAccount;

		if (signerAccount) {
			// if spend account of fromAccountAddr different with signerAccount
			// then throw error.
			if (from.getSpendAddress() !== signerAccount.addr) {
				throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT, {
					spend: from.getSpendAddress(),
					signer: signerAccount.addr,
				});
			}
		} else {
			// throw error if your don't provide account `signature`.
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_SECRET_KEY);
		}
	}

	/**
	 * Loads logic signature for contract mode, creates a new runtime account
	 * associated with lsig
	 * @param fileName ASC filename
	 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 * @param logs only show logs on console when set as true. By default this value is true
	 * @returns loaded logic signature from assets/<file_name>.teal
	 */
	loadLogic(fileName: string, scTmplParams?: SCParams, logs = true): LogicSigAccount {
		const program = getProgram(fileName, scTmplParams, logs);
		return this.createLsigAccount(program, []); // args can be set during executeTx
	}

	/**
	 * Creates a new account with logic signature and smart contract arguments
	 * in the runtime store. The arguments are used when we send a transaction with this
	 * account and verify it.
	 * @param program TEAL code
	 * @param args arguments passed
	 * @returns logic signature with arguments.
	 */
	createLsigAccount(program: string, args: Uint8Array[]): LogicSigAccount {
		if (program === "") {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_PROGRAM);
		}
		const lsig = new LogicSigAccount(program, args);

		// create new lsig account in runtime
		const acc = new AccountStore(0, { addr: lsig.address(), sk: new Uint8Array(0) });
		this.store.accounts.set(acc.address, acc);
		return lsig;
	}

	/**
	 * Transfers `amount` of microAlgos from `from` address to `to` address
	 * @param from From account
	 * @param to to address
	 * @param amount amount of algo in microalgos
	 */
	fundLsig(from: RuntimeAccountI, to: AccountAddress, amount: number): TxReceipt {
		const fundParam: types.ExecParams = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: from,
			toAccountAddr: to,
			amountMicroAlgos: amount,
			payFlags: { totalFee: 1000 },
		};
		return this.executeTx([fundParam])[0];
	}

	/**
	 * validate logic signature and teal logic
	 * @param txnParam Transaction Parameters
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	validateLsigAndRun(txnParam: types.Lsig, debugStack?: number): TxReceipt {
		// check if transaction is signed by logic signature,
		// if yes verify signature and run logic

		if (txnParam.sign === types.SignType.LogicSignature && txnParam.lsig) {
			this.ctx.args = txnParam.args ?? txnParam.lsig.lsig.args;

			// signature validation
			const fromAccountAddr = txnParam.fromAccountAddr;
			const lsigAccountAddr = txnParam.lsig.address();

			const signerAddr = txnParam.lsig.isDelegated() ? fromAccountAddr : lsigAccountAddr;

			const result = txnParam.lsig.lsig.verify(decodeAddress(signerAddr).publicKey);
			if (!result) {
				throw new RuntimeError(RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_VALIDATION_FAILED, {
					address: signerAddr,
				});
			}

			// verify spend account
			const spendAddr = this.getAccount(fromAccountAddr).getSpendAddress();
			if (spendAddr !== signerAddr) {
				throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT, {
					spend: spendAddr,
					signer: signerAddr,
				});
			}

			// logic validation
			const program = convertToString(txnParam.lsig.lsig.logic);
			if (program === "") {
				throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_PROGRAM);
			}
			return this.run(program, ExecutionMode.SIGNATURE, 0, debugStack);
		} else {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_NOT_FOUND);
		}
	}

	/**
	 * This function executes a transaction based on a smart contract logic and updates state afterwards
	 * Check out {@link https://algobuilder.dev/guide/execute-transaction.html#execute-transaction|execute-transaction}
	 * for more info.
	 * @param txnParams : Transaction parameters
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	executeTx(
		txnParams: types.ExecParams[] | algosdk.SignedTransaction[],
		debugStack?: number
	): TxReceipt[] {
		// TODO: union above and create new type in task below:
		// https://www.pivotaltracker.com/n/projects/2452320/stories/181295625
		let signedTransactions: algosdk.SignedTransaction[];
		let appDef: types.AppDefinition | types.SmartContract | undefined;
		const appDefMap: Map<number, types.AppDefinition | types.SmartContract> = new Map();
		const lsigMap: Map<number, types.Lsig> = new Map();

		if (types.isExecParams(txnParams[0])) {
			const dummySource: types.SourceCompiled = {
				metaType: types.MetaType.BYTES,
				approvalProgramBytes: new Uint8Array(32),
				clearProgramBytes: new Uint8Array(32),
			};

			const txns = txnParams.map((txnParamerter, index) => {
				const txn = cloneDeep(txnParamerter as types.ExecParams);
				if (txn.sign === types.SignType.LogicSignature) {
					lsigMap.set(index, txn);
				}
				appDef = undefined;
				switch (txn.type) {
					case types.TransactionType.DeployASA: {
						if (txn.asaDef === undefined) txn.asaDef = this.loadedAssetsDefs[txn.asaName];
						break;
					}
					case types.TransactionType.DeployApp: {
						appDef = txn.appDefinition;
						txn.appDefinition = {
							...txn.appDefinition,
							...dummySource,
						};
						break;
					}
					case types.TransactionType.UpdateApp: {
						appDef = txn.newAppCode;
						txn.newAppCode = dummySource;
						break;
					}
				}

				if (appDef !== undefined) appDefMap.set(index, appDef);
				return txn;
			});

			// get current txn and txn group (as encoded obj)
			[, signedTransactions] = this.createTxnContext(txns as types.ExecParams[]);
		} else {
			signedTransactions = txnParams.map((txnParameter) => {
				return txnParameter as algosdk.SignedTransaction;
			});
		}

		const gtxs = this.getEncodedGroupTxns(signedTransactions);
		const tx = gtxs[0];

		// validate first and last rounds
		this.validateTxRound(gtxs);
		// checks if the transactions are not duplicated
		this.assertNoDuplicateTransaction(gtxs);
		// initialize context before each execution
		// Prepare shared space at each execution of transaction/s.
		// state is a deep copy of store
		this.ctx = new Ctx(cloneDeep(this.store), tx, gtxs, [], this, debugStack);

		// calculate budget for single/group tx
		const applCallTxNumber = gtxs.filter(
			(txn) => txn.type === TransactionTypeEnum.APPLICATION_CALL
		).length;

		this.ctx.budget = MAX_APP_PROGRAM_COST * applCallTxNumber;
		const txReceipts = this.ctx.processTransactions(signedTransactions, appDefMap, lsigMap);

		// update store only if all the transactions are passed
		this.store = this.ctx.state;

		// return transaction receipt(s)
		return txReceipts;
	}

	/**
	 * This function executes TEAL code line by line
	 * @param program : teal code as string
	 * @param executionMode : execution Mode (Stateless or Stateful)
	 * @param indexInGroup: txn index in transaction group.
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 * NOTE: Application mode is only supported in TEALv > 1
	 */
	run(
		program: string,
		executionMode: ExecutionMode,
		indexInGroup: number,
		debugStack?: number
	): TxReceipt {
		const interpreter = new Interpreter();
		// set new tx receipt
		const txReceipt = {
			txn: this.ctx.tx,
			txID: this.ctx.tx.txID,
		};
		this.ctx.state.txReceipts.set(this.ctx.tx.txID, txReceipt);
		// reset pooled opcode cost for single tx, this is to handle singular functions
		// which don't "initialize" a new ctx (eg. deployApp)
		if (this.ctx.gtxs.length === 1 && !this.ctx.isInnerTx) {
			this.ctx.pooledApplCost = 0;
		}
		interpreter.execute(program, executionMode, this, debugStack);

		if (executionMode === ExecutionMode.APPLICATION) {
			this.ctx.sharedScratchSpace.set(indexInGroup, interpreter.scratch);
		}
		return txReceipt;
	}

	/**
	 * Creates a group transaction array
	 * @param signedTransactions : teal code as string
	 * @returns groupTransactions array of EncTx type
	 */
	getEncodedGroupTxns(signedTransactions: SignedTransaction[]): EncTx[] {
		let gtxs: EncTx[] = [];
		gtxs = signedTransactions.map((signedTransaction) => {
			const txn = signedTransaction.txn.get_obj_for_encoding() as EncTx;
			txn.txID = signedTransaction.txn.txID();
			return txn;
		});
		return gtxs;
	}

	/**
	 * Sends a SignedTransaction object
	 * @param signedTransaction
	 * @returns const txReceipts = this.ctx.processTransactions(signedTransactions, appDefMap, lsigMap);
	 */
	sendSignedTransaction(signedTransaction: SignedTransaction): TxReceipt[] {
		//TODO: implement verify signature function
		//TODO: rename the method to be complatible with algob
		// this.verifySignature(signedTransaction);
		const encodedTxnObj = signedTransaction.txn.get_obj_for_encoding() as EncTx;
		encodedTxnObj.txID = signedTransaction.txn.txID();
		this.ctx = new Ctx(cloneDeep(this.store), encodedTxnObj, [encodedTxnObj], [], this);
		const txReceipt = this.ctx.processTransactions([signedTransaction], undefined);
		this.store = this.ctx.state;
		return txReceipt;
	}

	/**
	 * Validate signature for Algorand account on transaction params.
	 * Include check spending account when creating a transaction from Algorand account
	 * Throw RuntimeError if signature is invalid.
	 * @param signedTransaction signedTransaction object.
	 */
	validateSecretKeySignature(signedTransaction: SignedTransaction): void {
		const fromAccountAddr = webTx.getTxFromAddress(signedTransaction.txn);
		const fromAccount = this.getAccount(fromAccountAddr);
		if (signedTransaction.sig !== undefined) {
			const accountSpendAddr = fromAccount.getSpendAddress();
			let signerAddr;
			if (signedTransaction.sgnr !== undefined) {
				signerAddr = algosdk.encodeAddress(signedTransaction.sgnr);
			} else {
				//if .sgnr is undefined it means the singer is 'from'
				signerAddr = fromAccountAddr;
			}
			if (accountSpendAddr !== signerAddr) {
				throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT, {
					spend: accountSpendAddr,
					signer: signerAddr,
				});
			}
		} else {
			// throw error if your don't provide account `signature`.
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_SECRET_KEY);
		}
	}
}
