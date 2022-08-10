/* eslint-disable */
import { tx as webTx, types } from "@algo-builder/web";
import algosdk, {
	getApplicationAddress,
	makeAssetTransferTxnWithSuggestedParams,
	modelsv2,
	Transaction,
	TransactionType,
} from "algosdk";

import { AccountStore, getProgram, parseASADef, Runtime } from ".";
import { RuntimeAccount } from "./account";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { validateOptInAccNames } from "./lib/asa";
import {
	ALGORAND_MIN_TX_FEE,
	MAX_APP_PROGRAM_COST,
	MAX_GLOBAL_SCHEMA_ENTRIES,
	MAX_LOCAL_SCHEMA_ENTRIES,
	ZERO_ADDRESS_STR,
} from "./lib/constants";
import {
	calculateFeeCredit,
	isEncTxApplicationCreate,
	isEncTxAssetCreate,
	isEncTxAssetDeletion,
	isEncTxAssetOptIn,
	isEncTxAssetReconfigure,
	isEncTxAssetRevoke,
	isEncTxAssetTransfer,
} from "./lib/txn";
import { mockSuggestedParams } from "./mock/tx";
import { getProgramVersion } from "./parser/parser";
import {
	AccountAddress,
	AccountStoreI,
	AppInfo,
	ASADeploymentFlags,
	ASAInfo,
	AssetHoldingM,
	Context,
	EncTx,
	ExecutionMode,
	ID,
	SCParams,
	SSCAttributesM,
	StackElem,
	State,
	TxReceipt,
} from "./types";

const APPROVAL_PROGRAM = "approval-program";
const CLEAR_PROGRAM = "clear-state-program";

export class Ctx implements Context {
	state: State;
	tx: EncTx;
	gtxs: EncTx[];
	args: Uint8Array[];
	runtime: Runtime;
	debugStack?: number; //  max number of top elements from the stack to print after each opcode execution.
	sharedScratchSpace: Map<number, StackElem[]>; // here number is index of transaction in a group
	knowableID: Map<number, ID>; // here number is index of transaction in a group
	pooledApplCost: number; // total opcode cost for each application call for single/group tx
	// inner transaction props
	isInnerTx: boolean; // true if "ctx" is switched to an inner transaction
	innerTxAppIDCallStack: number[];
	remainingTxns: number;
	remainingFee: number;
	budget: number;
	lastLog: Uint8Array;
	constructor(
		state: State,
		tx: EncTx,
		gtxs: EncTx[],
		args: Uint8Array[],
		runtime: Runtime,
		debugStack?: number
	) {
		this.state = state;
		this.tx = tx;
		this.gtxs = gtxs;
		this.args = args;
		this.runtime = runtime;
		this.debugStack = debugStack;
		this.lastLog = new Uint8Array([]);
		// Mapping from the tx index number to the scratch space.
		// Scratch space is a list of elements.
		this.sharedScratchSpace = new Map<number, StackElem[]>();
		this.knowableID = new Map<number, ID>();
		this.pooledApplCost = 0;
		// inner transaction props
		this.isInnerTx = false;
		// initial app call stack
		this.innerTxAppIDCallStack = [tx.apid ?? 0];
		this.remainingFee = 0;
		this.remainingTxns = 256;
		this.budget = MAX_APP_PROGRAM_COST;
	}

	private setAndGetTxReceipt(): TxReceipt {
		const info = { txn: this.tx, txID: this.tx.txID };
		this.state.txReceipts.set(this.tx.txID, info);
		return info;
	}

	// verify account's balance is above minimum required balance
	assertAccBalAboveMin(address: string): void {
		const account = this.getAccount(address);
		if (account.balance() < account.minBalance) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE, {
				accBalance: account.balance(),
				address: address,
				minbalance: account.minBalance,
			});
		}
	}

	// verifies assetId is not frozen for an account
	assertAssetNotFrozen(assetIndex: number, address: AccountAddress): void {
		const assetHolding = this.getAssetHolding(assetIndex, address);
		if (assetHolding["is-frozen"]) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.ACCOUNT_ASSET_FROZEN, {
				assetId: assetIndex,
				address: address,
			});
		}
	}

	// verify approval program and clear state program build in same version
	verifyTEALVersionIsMatch(approvalProg: string, clearProgram: string): void {
		const approvalVersion = getProgramVersion(approvalProg);
		const clearVersion = getProgramVersion(clearProgram);

		if (approvalVersion !== clearVersion) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.PROGRAM_VERSION_MISMATCH, {
				approvalVersion,
				clearVersion,
			});
		}
	}

	/**
	 * Fetches account from `runtime.ctx`
	 * @param address account address
	 */
	getAccount(address: string): AccountStoreI {
		const account = this.state.accounts.get(address);
		return this.runtime.assertAccountDefined(address, account);
	}

	/**
	 * Returns asset creator account from runtime.ctx or throws error is it doesn't exist
	 * @param assetId Asset Index
	 */
	getAssetAccount(assetId: number): AccountStoreI {
		const addr = this.state.assetDefs.get(assetId);
		if (addr === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND, { assetId: assetId });
		}
		return this.runtime.assertAccountDefined(addr, this.state.accounts.get(addr));
	}

	/**
	 * Returns Asset Definitions
	 * @param assetId Asset Index
	 */
	getAssetDef(assetId: number): modelsv2.AssetParams {
		const creatorAcc = this.getAssetAccount(assetId);
		const assetDef = creatorAcc.getAssetDef(assetId);
		return this.runtime.assertAssetDefined(assetId, assetDef);
	}

	/**
	 * Returns Asset Holding from an account
	 * @param assetIndex Asset Index
	 * @param address address of account to get holding from
	 */
	getAssetHolding(assetIndex: number, address: AccountAddress): AssetHoldingM {
		const account = this.runtime.assertAccountDefined(
			address,
			this.state.accounts.get(address)
		);
		const assetHolding = account.getAssetHolding(assetIndex);
		if (assetHolding === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.ASA_NOT_OPTIN, {
				assetId: assetIndex,
				address: address,
			});
		}
		return assetHolding;
	}

	/**
	 * Fetches app from `ctx state`
	 * @param appID Application Index'
	 * @param line Line number in teal file
	 */
	getApp(appID: number, line?: number): SSCAttributesM {
		const lineNumber = line ?? "unknown";
		if (!this.state.globalApps.has(appID)) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: lineNumber,
			});
		}
		const accAddress = this.runtime.assertAddressDefined(this.state.globalApps.get(appID));
		const account = this.runtime.assertAccountDefined(
			accAddress,
			this.state.accounts.get(accAddress)
		);
		return this.runtime.assertAppDefined(appID, account.getApp(appID));
	}

	getCallerApplicationID(): number {
		let callerApplicationID = 0;
		if (this.innerTxAppIDCallStack.length > 0) {
			callerApplicationID = this.innerTxAppIDCallStack[this.innerTxAppIDCallStack.length - 1];
		}
		return callerApplicationID;
	}

	getCallerApplicationAddress(): AccountAddress {
		const callerApplicationID = this.getCallerApplicationID();
		if (callerApplicationID === 0) return ZERO_ADDRESS_STR;
		return getApplicationAddress(callerApplicationID);
	}

	// transfer ALGO as per transaction parameters
	transferAlgo(transaction: algosdk.Transaction): TxReceipt {
		const fromAccount = this.getAccount(webTx.getTxFromAddress(transaction));
		const toAccount = this.getAccount(webTx.getTxToAddress(transaction));
		fromAccount.amount -= BigInt(transaction.amount); // remove 'x' algo from sender
		toAccount.amount += BigInt(transaction.amount); // add 'x' algo to receiver
		this.assertAccBalAboveMin(fromAccount.address);

		const closeRemainderToAddress = webTx.getTxCloseReminderToAddress(transaction);
		if (closeRemainderToAddress !== undefined) {
			this.verifyCloseRemainderTo(transaction);
			const closeReminderToAccount = this.getAccount(closeRemainderToAddress);
			// transfer funds of sender to closeRemTo account
			closeReminderToAccount.amount += fromAccount.amount;
			fromAccount.amount = 0n; // close sender's account
		}
		return this.setAndGetTxReceipt();
	}

	/**
	 * Deploy asset using asa.yaml file
	 * @param name asset name
	 * @param fromAccountAddr account address
	 * @param flags asa deployment flags
	 */
	deployASA(name: string, fromAccountAddr: AccountAddress, flags: ASADeploymentFlags): ASAInfo {
		if (this.runtime.loadedAssetsDefs === {}) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.ASA_FILE_IS_UNDEFINED);
		}
		if (this.runtime.loadedAssetsDefs[name] === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.ASA_DEFINITION_NO_FOUND_IN_ASA_FILE);
		}
		return this.deployASADef(name, this.runtime.loadedAssetsDefs[name], fromAccountAddr, flags);
	}

	/**
	 * Deploy Asset without using asa.yaml file
	 * @param name ASA name
	 * @param asaDef asset defitions
	 * @param fromAccountAddr account address of creator
	 * @param flags ASA Deployment Flags
	 */
	deployASADef(
		name: string,
		asaDef: types.ASADef,
		fromAccountAddr: AccountAddress,
		flags: ASADeploymentFlags
	): ASAInfo {
		const senderAcc = this.getAccount(fromAccountAddr);
		parseASADef(asaDef);
		validateOptInAccNames(this.state.accountNameAddress, asaDef);
		// create asset(with holding) in sender account
		const asset = senderAcc.addAsset(++this.state.assetCounter, name, asaDef);
		this.assertAccBalAboveMin(fromAccountAddr);
		this.runtime.mkAssetCreateTx(name, flags, asset);

		this.state.assetDefs.set(this.state.assetCounter, senderAcc.address);
		const asaInfo = {
			creator: senderAcc.address,
			assetIndex: this.state.assetCounter,
			assetDef: asset,
			txID: this.tx.txID,
			confirmedRound: this.runtime.getRound(),
			deleted: false,
		};
		this.state.assetNameInfo.set(name, asaInfo);

		// set & return transaction receipt
		this.state.txReceipts.set(this.tx.txID, asaInfo);
		return asaInfo;
	}

	/**
	 * Asset Opt-In for account in context
	 * @param assetIndex Asset Index
	 * @param address Account address to opt-into asset
	 * @param flags Transaction Parameters
	 */
	optInToASA(assetIndex: number, address: AccountAddress, flags: types.TxParams): TxReceipt {
		const assetDef = this.getAssetDef(assetIndex);
		makeAssetTransferTxnWithSuggestedParams(
			address,
			address,
			undefined,
			undefined,
			0,
			undefined,
			assetIndex,
			mockSuggestedParams(flags, this.runtime.getRound())
		);

		const assetHolding: AssetHoldingM = {
			amount: 0n,
			"asset-id": assetIndex,
			creator: assetDef.creator,
			"is-frozen": assetDef.defaultFrozen ? assetDef.defaultFrozen : false,
		};
		const account = this.getAccount(address);
		account.optInToASA(assetIndex, assetHolding);
		this.assertAccBalAboveMin(address);
		return this.setAndGetTxReceipt();
	}

	/**
	 * deploy a new application and returns application id
	 * @param creatorAddr creator account address
	 * @param appDefinition source of approval and clear program
	 * @param idx index of transaction in group
	 * @param scTmplParams Smart Contract template parameters
	 * NOTE When creating or opting into an app, the minimum balance grows before the app code runs
	 */
	deployApp(
		creatorAddr: AccountAddress,
		appDefinition: types.AppDefinition,
		idx: number,
		scTmplParams?: SCParams
	): AppInfo {
		const senderAcc = this.getAccount(creatorAddr);

		if (appDefinition.metaType === types.MetaType.BYTES) {
			throw new Error("not support this format");
		}

		const approvalFile =
			appDefinition.metaType === types.MetaType.FILE
				? appDefinition.approvalProgramFilename
				: appDefinition.approvalProgramCode;

		const clearFile =
			appDefinition.metaType === types.MetaType.FILE
				? appDefinition.clearProgramFilename
				: appDefinition.clearProgramCode;

		const approvalProgTEAL =
			appDefinition.metaType === types.MetaType.FILE
				? getProgram(appDefinition.approvalProgramFilename, scTmplParams)
				: appDefinition.approvalProgramCode;

		const clearProgTEAL =
			appDefinition.metaType === types.MetaType.FILE
				? getProgram(appDefinition.clearProgramFilename, scTmplParams)
				: appDefinition.clearProgramCode;

		if (approvalProgTEAL === "") {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM);
		}
		if (clearProgTEAL === "") {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM);
		}

		this.verifyTEALVersionIsMatch(approvalProgTEAL, clearProgTEAL);

		//verify that MaxGlobalSchemaEntries <= 64 and MaxLocalSchemaEntries <= 16
		const globalSchemaEntries = appDefinition.globalInts + appDefinition.globalBytes;
		const localSchemaEntries = appDefinition.localInts + appDefinition.localBytes;

		if (
			localSchemaEntries > MAX_LOCAL_SCHEMA_ENTRIES ||
			globalSchemaEntries > MAX_GLOBAL_SCHEMA_ENTRIES
		) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.MAX_SCHEMA_ENTRIES_EXCEEDED, {
				localState: localSchemaEntries,
				localMax: MAX_LOCAL_SCHEMA_ENTRIES,
				globalState: globalSchemaEntries,
				globalMax: MAX_GLOBAL_SCHEMA_ENTRIES,
			});
		}

		// create app with id = 0 in globalApps for teal execution
		const app = senderAcc.addApp(0, {
			...appDefinition,
			metaType: types.MetaType.SOURCE_CODE,
			approvalProgramCode: approvalProgTEAL,
			clearProgramCode: clearProgTEAL,
		});

		this.assertAccBalAboveMin(senderAcc.address);
		this.state.accounts.set(senderAcc.address, senderAcc);
		this.state.globalApps.set(app.id, senderAcc.address);
		// execute TEAL code with appID = 0
		this.runtime.run(approvalProgTEAL, ExecutionMode.APPLICATION, idx, this.debugStack);

		// create new application in globalApps map
		this.state.globalApps.set(++this.state.appCounter, senderAcc.address);

		const attributes = this.getApp(0);
		senderAcc.createdApps.delete(0); // remove zero app from sender's account
		this.state.globalApps.delete(0); // remove zero app from context
		senderAcc.createdApps.set(this.state.appCounter, attributes);
		const appInfo: AppInfo = {
			creator: senderAcc.address,
			appID: this.state.appCounter,
			applicationAccount: getApplicationAddress(this.state.appCounter),
			txID: this.tx.txID,
			confirmedRound: this.runtime.getRound(),
			timestamp: Math.round(+new Date() / 1000),
			deleted: false,
			// we don't have access to bytecode in runtime
			approvalFile,
			clearFile,
		};

		this.state.appNameMap.set(approvalFile + "-" + clearFile, appInfo);
		if (
			approvalFile + "-" + clearFile !== appDefinition.appName &&
			this.state.appNameMap.get(appDefinition.appName) !== undefined
		) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NAME_ALREADLY_USED, {
				appName: appDefinition.appName,
			});
		}

		this.state.appNameMap.set(appDefinition.appName, appInfo);

		const acc = new AccountStore(
			0,
			new RuntimeAccount({
				addr: getApplicationAddress(this.state.appCounter),
				sk: new Uint8Array(0),
			})
		);
		this.state.accounts.set(acc.address, acc);

		// return transaction receipt
		return appInfo;
	}

	/**
	 * Account address opt-in for application Id
	 * @param accountAddr Account address to opt into application
	 * @param appID Application index
	 * @param idx index of transaction in group
	 * NOTE: When creating or opting into an app, the minimum balance grows before the app code runs
	 */
	optInToApp(accountAddr: AccountAddress, appID: number, idx: number): TxReceipt {
		const appParams = this.getApp(appID);

		const account = this.getAccount(accountAddr);
		account.optInToApp(appID, appParams);
		this.assertAccBalAboveMin(accountAddr);
		try {
			return this.runtime.run(
				appParams[APPROVAL_PROGRAM],
				ExecutionMode.APPLICATION,
				idx,
				this.debugStack
			);
		} catch (error) {
			account.closeApp(appID); // remove already added state if optIn fails
			throw error;
		}
	}

	/**
	 * Verify Pooled Transaction Fees
	 * supports pooled fees where one transaction can pay the
	 * fees of other transactions within an atomic group.
	 * For atomic transactions, the protocol sums the number of
	 * transactions and calculates the total amount of required fees,
	 * then calculates the amount of fees submitted by all transactions.
	 * If the collected fees are greater than or equal to the required amount,
	 * the transaction fee requirement will be met.
	 * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
	 */
	verifyMinimumFees(): void {
		// pooled fee for inner tx is calculated at itx_submit
		if (this.isInnerTx) {
			return;
		}

		const credit = calculateFeeCredit(this.gtxs);
		this.remainingFee = credit.remainingFee;
		if (credit.remainingFee < 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH, {
				required: credit.requiredFee,
				collected: credit.collectedFee,
			});
		}
	}

	/**
	 * Verify closeRemainderTo field is different than fromAccountAddr
	 * @param transaction transaction params
	 */
	verifyCloseRemainderTo(transaction: Transaction): void {
		if (transaction.closeRemainderTo == undefined) return;
		if (
			webTx.getTxCloseReminderToAddress(transaction) === webTx.getTxFromAddress(transaction)
		) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INVALID_CLOSE_REMAINDER_TO);
		}
	}

	/**
	 * Verify if the current inner transaction can be executed
	 */
	verifyAndUpdateInnerAppCallStack(): void {
		// verify
		if (!this.isInnerTx) return;

		if (this.innerTxAppIDCallStack.length >= 8) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INNER_APP_DEEP_EXCEEDED);
		}
		const appID = this.tx.apid ?? 0;
		if (appID > 0 && this.innerTxAppIDCallStack.find((id) => id === appID) !== undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INNER_APP_SELF_CALL);
		}

		// update inner tx call stack
		if (appID > 0) this.innerTxAppIDCallStack.push(appID);
	}

	/**
	 * Deduct transaction fee from sender account.
	 * @param sender Sender address
	 * @param index Index of current tx being processed in tx group
	 */
	deductFee(sender: AccountAddress, index: number, params: types.TxParams): void {
		let fee = BigInt(this.gtxs[index].fee ?? 0);
		// If flatFee boolean is not set, change fee value
		if (!params.flatFee && params.totalFee === undefined) {
			fee = BigInt(Math.max(ALGORAND_MIN_TX_FEE, Number(this.gtxs[index].fee)));
		}
		const fromAccount = this.getAccount(sender);
		fromAccount.amount -= fee; // remove tx fee from Sender's account
		this.assertAccBalAboveMin(fromAccount.address);
	}

	// transfer ASSET as per transaction parameters
	transferAsset(transaction: Transaction): TxReceipt {
		const fromAccountAddr = webTx.getTxFromAddress(transaction);
		const toAccountAddr = webTx.getTxToAddress(transaction);
		const transactionFlags = webTx.getTxFlags(transaction);
		if (BigInt(transaction.amount) === 0n && fromAccountAddr === toAccountAddr) {
			this.optInToASA(transaction.assetIndex, fromAccountAddr, transactionFlags);
		} else if (BigInt(transaction.amount) !== 0n) {
			this.assertAssetNotFrozen(transaction.assetIndex as number, fromAccountAddr);
			this.assertAssetNotFrozen(transaction.assetIndex as number, toAccountAddr);
		}

		const fromAssetHolding = this.getAssetHolding(
			transaction.assetIndex as number,
			fromAccountAddr
		);
		const toAssetHolding = this.getAssetHolding(
			transaction.assetIndex as number,
			toAccountAddr
		);
		if (fromAssetHolding.amount - BigInt(transaction.amount) < 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS, {
				amount: transaction.amount,
				address: fromAccountAddr,
			});
		}
		fromAssetHolding.amount -= BigInt(transaction.amount);
		toAssetHolding.amount += BigInt(transaction.amount);

		if (transactionFlags.closeRemainderTo) {
			this.verifyCloseRemainderTo(transaction);

			const closeToAddr = transactionFlags.closeRemainderTo;
			if (fromAccountAddr === fromAssetHolding.creator) {
				throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CREATOR);
			}
			this.assertAssetNotFrozen(transaction.assetIndex as number, closeToAddr);

			const closeRemToAssetHolding = this.getAssetHolding(
				transaction.assetIndex as number,
				closeToAddr
			);
			// transfer assets of sender to closeRemTo account
			closeRemToAssetHolding.amount += fromAssetHolding.amount;
			const fromAccount = this.getAccount(fromAccountAddr);
			fromAccount.closeAsset(transaction.assetIndex as number);
		}
		return this.setAndGetTxReceipt();
	}

	/**
	 * https://developer.algorand.org/docs/features/asa/#modifying-an-asset
	 * Modifies asset fields
	 * @param assetId Asset Index
	 * @param fields Asset modifying fields
	 */
	modifyAsset(assetId: number, fields: types.AssetModFields): TxReceipt {
		const creatorAcc = this.getAssetAccount(assetId);
		creatorAcc.modifyAsset(assetId, fields);
		return this.setAndGetTxReceipt();
	}

	/**
	 * https://developer.algorand.org/docs/features/asa/#freezing-an-asset
	 * Freezes assets for a target account
	 * @param assetId asset index
	 * @param freezeTarget target account
	 * @param freezeState target state
	 */
	freezeAsset(assetId: number, freezeTarget: string, freezeState: boolean): TxReceipt {
		const acc = this.runtime.assertAccountDefined(
			freezeTarget,
			this.state.accounts.get(freezeTarget)
		);
		acc.setFreezeState(assetId, freezeState);
		return this.setAndGetTxReceipt();
	}

	/**
	 * https://developer.algorand.org/docs/features/asa/#revoking-an-asset
	 * Revoking an asset for an account removes a specific number of the asset
	 * from the revoke target account.
	 * @param recipient asset receiver address
	 * @param assetID asset index
	 * @param revocationTarget revoke target account
	 * @param amount amount of assets
	 */
	revokeAsset(
		recipient: string,
		assetID: number,
		revocationTarget: string,
		amount: bigint
	): TxReceipt {
		// Transfer assets
		const fromAssetHolding = this.getAssetHolding(assetID, revocationTarget);
		const toAssetHolding = this.getAssetHolding(assetID, recipient);

		if (fromAssetHolding.amount - amount < 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS, {
				amount: amount,
				address: revocationTarget,
			});
		}
		fromAssetHolding.amount -= amount;
		toAssetHolding.amount += amount;
		return this.setAndGetTxReceipt();
	}

	/**
	 * https://developer.algorand.org/docs/features/asa/#destroying-an-asset
	 * Destroy asset
	 * @param assetId asset index
	 */
	destroyAsset(assetId: number): TxReceipt {
		const creatorAcc = this.getAssetAccount(assetId);
		// destroy asset from creator's account
		creatorAcc.destroyAsset(assetId);
		// delete asset holdings from all accounts
		this.state.accounts.forEach((value, key) => {
			value.assets.delete(assetId);
		});
		return this.setAndGetTxReceipt();
	}

	/**
	 * Delete application from account's state and global state
	 * @param appID Application Index
	 */
	deleteApp(appID: number): void {
		if (!this.state.globalApps.has(appID)) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: "unknown",
			});
		}
		const accountAddr = this.runtime.assertAddressDefined(this.state.globalApps.get(appID));
		if (accountAddr === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST);
		}
		const account = this.runtime.assertAccountDefined(
			accountAddr,
			this.state.accounts.get(accountAddr)
		);

		account.deleteApp(appID);
		this.state.globalApps.delete(appID);
	}

	/**
	 * Closes application from account's state
	 * @param sender Sender address
	 * @param appID application index
	 */
	closeApp(sender: AccountAddress, appID: number): void {
		const fromAccount = this.getAccount(sender);
		// https://developer.algorand.org/docs/reference/cli/goal/app/closeout/#search-overlay
		this.runtime.assertAppDefined(appID, this.getApp(appID));
		fromAccount.closeApp(appID); // remove app from local state
	}

	/**
	 * Update application
	 * @param appID application Id
	 * @param appSourceCode new application source
	 * @param idx index of transaction in group
	 * @param scTmplParams Smart Contract template parameters
	 */
	updateApp(
		appID: number,
		appSourceCode: types.SmartContract,
		idx: number,
		scTmplParams?: SCParams
	): TxReceipt {
		if (appSourceCode.metaType === types.MetaType.BYTES) {
			throw new Error("not support this format");
		}

		const approvalProgTEAL =
			appSourceCode.metaType === types.MetaType.FILE
				? getProgram(appSourceCode.approvalProgramFilename, scTmplParams)
				: appSourceCode.approvalProgramCode;

		const clearProgTEAL =
			appSourceCode.metaType === types.MetaType.FILE
				? getProgram(appSourceCode.clearProgramFilename, scTmplParams)
				: appSourceCode.clearProgramCode;

		if (approvalProgTEAL === "") {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM);
		}
		if (clearProgTEAL === "") {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM);
		}

		this.verifyTEALVersionIsMatch(approvalProgTEAL, clearProgTEAL);
		const appParams = this.getApp(appID);
		const txReceipt = this.runtime.run(
			appParams[APPROVAL_PROGRAM],
			ExecutionMode.APPLICATION,
			idx,
			this.debugStack
		);

		const updatedApp = this.getApp(appID);
		updatedApp[APPROVAL_PROGRAM] = approvalProgTEAL;
		updatedApp[CLEAR_PROGRAM] = clearProgTEAL;
		return txReceipt;
	}

	/**
	 * Rekeys the account
	 * @param txn transaction
	 * @param rekeyTo address
	 */
	rekeyTo(txn: Transaction, reKeyTo: string | undefined): void {
		if (reKeyTo === undefined) return;
		const fromAccount = this.getAccount(webTx.getTxFromAddress(txn));
		fromAccount.rekeyTo(reKeyTo);
	}

	/**
	 * Process transactions in ctx
	 * - Runs TEAL code if associated with transaction
	 * - Executes the transaction on ctx
	 * Note: we're doing this because if any one tx in group fails,
	 * then it does not affect runtime.store, otherwise we just update
	 * store with ctx (if all transactions are executed successfully).
	 * @param txParams Transaction Parameters
	 */
	/* eslint-disable sonarjs/cognitive-complexity */
	processTransactions(
		signedTransactions: algosdk.SignedTransaction[],
		appDefMap?: Map<number, types.AppDefinition | types.SmartContract>,
		lsigMap?: Map<number, types.Lsig>
	): TxReceipt[] {
		const txReceipts: TxReceipt[] = [];
		let r: TxReceipt;
		this.verifyMinimumFees();
		this.verifyAndUpdateInnerAppCallStack();
		signedTransactions.forEach((signedTransaction, idx) => {
			const fromAccountAddr = webTx.getTxFromAddress(signedTransaction.txn);
			let payFlags: types.TxParams = {};
			payFlags = webTx.getTxFlags(signedTransaction.txn);
			this.deductFee(fromAccountAddr, idx, payFlags);
			if (lsigMap !== undefined && lsigMap.get(idx) !== undefined) {
				let lsig = lsigMap.get(idx);
				this.tx = this.gtxs[idx]; // update current tx to index of stateless
				r = this.runtime.validateLsigAndRun(lsig as types.Lsig, this.debugStack);
				this.tx = this.gtxs[0];
			} //
			//after executing stateless tx updating current tx to default (index 0)
			else if (signedTransaction.sgnr || signedTransaction.sig) {
				this.runtime.validateSecretKeySignature(signedTransaction);
			}
			//verify and reduce number remain Txn
			if (this.remainingTxns > 0) {
				this.remainingTxns--;
			} else {
				throw new RuntimeError(RUNTIME_ERRORS.GENERAL.TOO_MANY_INNER_TXN);
			}
			// https://developer.algorand.org/docs/features/asc1/stateful/#the-lifecycle-of-a-stateful-smart-contract
			switch (signedTransaction.txn.type) {
				case TransactionType.pay: {
					// if toAccountAddre doesn't exist in runtime env
					// then we will add it to runtime env.
					if (
						this.state.accounts.get(
							algosdk.encodeAddress(signedTransaction.txn.to.publicKey)
						) === undefined
					) {
						this.state.accounts.set(
							algosdk.encodeAddress(signedTransaction.txn.to.publicKey),
							new AccountStore(0, {
								addr: algosdk.encodeAddress(signedTransaction.txn.to.publicKey),
								sk: new Uint8Array(0),
							})
						);
					}
					r = this.transferAlgo(signedTransaction.txn);
					break;
				}
				case TransactionType.keyreg: {
					// noop
					r = { txn: this.tx, txID: this.tx.txID };
					break;
				}
				case TransactionType.appl: {
					switch (signedTransaction.txn.appOnComplete) {
						case algosdk.OnApplicationComplete.NoOpOC: {
							//deployApp
							if (
								isEncTxApplicationCreate(signedTransaction.txn.get_obj_for_encoding() as EncTx)
							) {
								this.tx = this.gtxs[idx]; // update current tx to the requested index
								if (appDefMap === undefined) {
									throw new Error("App definition needs to be provided");
								}
								r = this.deployApp(
									fromAccountAddr,
									appDefMap.get(idx) as types.AppDefinition,
									idx
								);
								this.knowableID.set(idx, r.appID);
							} else {
								this.tx = this.gtxs[idx]; // update current tx to the requested index
								const appParams = this.getApp(signedTransaction.txn.appIndex);
								r = this.runtime.run(
									appParams[APPROVAL_PROGRAM],
									ExecutionMode.APPLICATION,
									idx,
									this.debugStack
								);
							}
							break;
						}
						case algosdk.OnApplicationComplete.ClearStateOC: {
							this.tx = this.gtxs[idx]; // update current tx to the requested index
							const appParams = this.runtime.assertAppDefined(
								signedTransaction.txn.appIndex,
								this.getApp(signedTransaction.txn.appIndex)
							);
							try {
								r = this.runtime.run(
									appParams["clear-state-program"],
									ExecutionMode.APPLICATION,
									idx,
									this.debugStack
								);
							} catch (error) {
								// if transaction type is Clear Call,
								// remove the app without throwing an error (rejecting tx)
								// tested by running on algorand network
							}
							// remove app from local state
							this.closeApp(fromAccountAddr, signedTransaction.txn.appIndex);
							break;
						}
						case algosdk.OnApplicationComplete.CloseOutOC: {
							this.tx = this.gtxs[idx]; // update current tx to the requested index
							const appParams = this.getApp(signedTransaction.txn.appIndex);
							r = this.runtime.run(
								appParams[APPROVAL_PROGRAM],
								ExecutionMode.APPLICATION,
								idx,
								this.debugStack
							);
							this.closeApp(fromAccountAddr, signedTransaction.txn.appIndex);
							break;
						}
						case algosdk.OnApplicationComplete.DeleteApplicationOC: {
							this.tx = this.gtxs[idx]; // update current tx to the requested index
							const appParams = this.getApp(signedTransaction.txn.appIndex);
							r = this.runtime.run(
								appParams[APPROVAL_PROGRAM],
								ExecutionMode.APPLICATION,
								idx,
								this.debugStack
							);
							this.deleteApp(signedTransaction.txn.appIndex);
							break;
						}
						case algosdk.OnApplicationComplete.OptInOC: {
							this.tx = this.gtxs[idx]; // update current tx to tx being exectuted in group
							r = this.optInToApp(fromAccountAddr, signedTransaction.txn.appIndex, idx);
							break;
						}
						case algosdk.OnApplicationComplete.UpdateApplicationOC: {
							this.tx = this.gtxs[idx]; // update current tx to the requested index
							if (appDefMap === undefined) {
								throw new Error("Not supported");
							}
							r = this.updateApp(
								signedTransaction.txn.appIndex,
								appDefMap.get(idx) as types.SmartContract,
								idx
							);
							break;
						}
					}
					break;
				}
				case TransactionType.acfg: {
					if (isEncTxAssetCreate(signedTransaction.txn.get_obj_for_encoding() as EncTx)) {
						this.tx = this.gtxs[idx]; // update current tx to the requested index
						const senderAcc = this.getAccount(fromAccountAddr);
						const flags: ASADeploymentFlags = {
							...payFlags,
							creator: { ...senderAcc.account, name: senderAcc.address },
						};
						r = this.deployASADef(
							signedTransaction.txn.assetName,
							webTx.getTxASADefinition(signedTransaction.txn),
							fromAccountAddr,
							flags
						);
						this.knowableID.set(idx, r.assetIndex);
					} else if (
						isEncTxAssetReconfigure(signedTransaction.txn.get_obj_for_encoding() as EncTx)
					) {
						const asset = this.getAssetDef(signedTransaction.txn.assetIndex);
						if (asset.manager !== fromAccountAddr) {
							throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, {
								address: asset.manager,
							});
						}
						// modify asset in ctx.
						r = this.modifyAsset(
							signedTransaction.txn.assetIndex,
							webTx.getAssetReconfigureFields(signedTransaction.txn)
						);
					} else if (
						isEncTxAssetDeletion(signedTransaction.txn.get_obj_for_encoding() as EncTx)
					) {
						const asset = this.getAssetDef(signedTransaction.txn.assetIndex);
						if (asset.manager !== fromAccountAddr) {
							throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, {
								address: asset.manager,
							});
						}
						r = this.destroyAsset(signedTransaction.txn.assetIndex as number);
					}
					break;
				}
				case TransactionType.axfer: {
					if (isEncTxAssetTransfer(signedTransaction.txn.get_obj_for_encoding() as EncTx)) {
						r = this.transferAsset(signedTransaction.txn);
					} else if (
						isEncTxAssetRevoke(signedTransaction.txn.get_obj_for_encoding() as EncTx)
					) {
						const asset = this.getAssetDef(signedTransaction.txn.assetIndex);
						if (asset.clawback !== fromAccountAddr) {
							throw new RuntimeError(RUNTIME_ERRORS.ASA.CLAWBACK_ERROR, {
								address: asset.clawback,
							});
						}
						if (payFlags.closeRemainderTo) {
							throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CLAWBACK);
						}
						r = this.revokeAsset(
							webTx.getTxToAddress(signedTransaction.txn),
							signedTransaction.txn.assetIndex,
							webTx.getTxRevokeAddress(signedTransaction.txn),
							BigInt(signedTransaction.txn.amount)
						);
					} else if (isEncTxAssetOptIn(signedTransaction.txn.get_obj_for_encoding() as EncTx)) {
						r = this.optInToASA(signedTransaction.txn.assetIndex, fromAccountAddr, payFlags);
					}
					break;
				}
				case TransactionType.afrz: {
					const asset = this.getAssetDef(signedTransaction.txn.assetIndex);
					if (asset.freeze !== fromAccountAddr) {
						throw new RuntimeError(RUNTIME_ERRORS.ASA.FREEZE_ERROR, { address: asset.freeze });
					}
					r = this.freezeAsset(
						signedTransaction.txn.assetIndex,
						webTx.getTxFreezeAddress(signedTransaction.txn),
						signedTransaction.txn.freezeState
					);
					break;
				}
			}
			// if closeRemainderTo field occur in txParam
			// we will change rekeyTo field to webTx.getFromAddress(txParam)
			if (payFlags.closeRemainderTo) {
				payFlags.rekeyTo = webTx.getTxFromAddress(signedTransaction.txn);
			} else {
				payFlags.rekeyTo = webTx.getTxReKeyToToAddress(signedTransaction.txn);
			}
			// apply rekey after pass all logic
			this.rekeyTo(signedTransaction.txn, payFlags.rekeyTo);
			if (this.isInnerTx) {
				// pop current application in the inner app call stack
				this.innerTxAppIDCallStack.pop();
				if (this.innerTxAppIDCallStack.length === 1) {
					this.runtime.ctx.innerTxAppIDCallStack.pop();
				}
			}
			if (r) {
				txReceipts.push(r);
			}
		});

		return txReceipts;
	}
}
