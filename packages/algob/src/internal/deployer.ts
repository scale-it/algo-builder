import {
	overrideASADef,
	parseASADef,
	types as rtypes,
	validateOptInAccNames,
} from "@algo-builder/runtime";
import { BuilderError, ERRORS, types as wtypes } from "@algo-builder/web";
import type { Account, EncodedMultisig, LogicSigAccount, modelsv2, Transaction } from "algosdk";
import * as algosdk from "algosdk";

import { txWriter } from "../internal/tx-log-writer";
import { AlgoOperator } from "../lib/algo-operator";
import { CompileOp } from "../lib/compile";
import { getDummyLsig, getLsig, getLsigFromCache } from "../lib/lsig";
import { blsigExt, loadBinaryLsig, readMsigFromFile } from "../lib/msig";
import {
	CheckpointFunctionsImpl,
	persistCheckpoint,
	registerCheckpoints,
} from "../lib/script-checkpoints";
import { executeTx, makeAndSignTx, signTransactions } from "../lib/tx";
import type {
	AppCache,
	ASCCache,
	CheckpointFunctions,
	CheckpointRepo,
	ConfirmedTxInfo,
	Deployer,
	FundASCFlags,
	LogicSig,
	LsigInfo,
	RuntimeEnv,
	SCParams,
	TxnReceipt,
} from "../types";
import { DeployerConfig } from "./deployer_cfg";

// Base class for deployer Run Mode (read access) and Deploy Mode (read and write access)
class DeployerBasicMode {
	protected readonly runtimeEnv: RuntimeEnv;
	protected readonly cpData: CheckpointRepo;
	protected readonly loadedAsaDefs: wtypes.ASADefs;
	protected readonly algoOp: AlgoOperator;
	protected readonly txWriter: txWriter;
	readonly accounts: rtypes.Account[];
	readonly accountsByName: rtypes.AccountMap;
	readonly indexerClient: algosdk.Indexer | undefined;
	checkpoint: CheckpointFunctions;

	constructor(deployerCfg: DeployerConfig) {
		this.runtimeEnv = deployerCfg.runtimeEnv;
		this.cpData = deployerCfg.cpData;
		this.loadedAsaDefs = deployerCfg.asaDefs;
		this.algoOp = deployerCfg.algoOp;
		this.accounts = deployerCfg.runtimeEnv.network.config.accounts;
		this.accountsByName = deployerCfg.accounts;
		this.txWriter = deployerCfg.txWriter;
		this.checkpoint = new CheckpointFunctionsImpl(
			deployerCfg.cpData,
			deployerCfg.runtimeEnv.network.name
		);
		this.indexerClient = deployerCfg.indexerClient;
	}

	protected get networkName(): string {
		return this.runtimeEnv.network.name;
	}

	/**
	 * Queries ASA Info from asset name
	 * @param name asset name
	 */
	getASAInfo(name: string): rtypes.ASAInfo {
		const found = this.asa.get(name);
		if (!found) {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_NOT_DEFINED, {
				assetName: name,
			});
		}
		return found;
	}

	private _getAccount(name: string): rtypes.Account {
		const found = this.accountsByName.get(name);
		if (!found) {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.ACCOUNT_NOT_FOUND, {
				assetName: name,
			});
		}
		return found;
	}

	/**
	 * Returns asset definition for given name
	 * @param name Asset name
	 * @param asaParams Asa parameters if user wants to override existing asa definition
	 */
	getASADef(name: string, asaParams?: Partial<wtypes.ASADef>): wtypes.ASADef {
		return overrideASADef(this.accountsByName, this.loadedAsaDefs[name], asaParams);
	}

	/**
	 * Returns checkpoint metadata
	 * @param key key for the map
	 */
	getCheckpointKV(key: string): string | undefined {
		return this.cpData.getMetadata(this.networkName, key);
	}

	isDefined(name: string): boolean {
		return this.cpData.isDefined(this.networkName, name);
	}

	get asa(): Map<string, rtypes.ASAInfo> {
		return this.cpData.precedingCP[this.networkName]?.asa ?? new Map();
	}

	get algodClient(): algosdk.Algodv2 {
		return this.algoOp.algodClient;
	}

	async waitForConfirmation(txId: string): Promise<ConfirmedTxInfo> {
		return await this.algoOp.waitForConfirmation(txId);
	}

	/**
	 * Queries blockchain using algodv2 for asset information by index
	 * @param assetIndex asset index
	 * @returns asset info from network
	 */
	async getAssetByID(assetIndex: number | bigint): Promise<modelsv2.Asset> {
		return await this.algoOp.getAssetByID(assetIndex);
	}

	log(msg: string, obj: any): void {
		this.txWriter.push(msg, obj);
	}

	/**
	 * Loads deployed Asset Definition from checkpoint.
	 * NOTE: This function returns "deployed" ASADef, as immutable properties
	 * of asaDef could be updated during tx execution (eg. update asset clawback)
	 * @param asaName asset name in asa.yaml
	 */
	loadASADef(asaName: string): wtypes.ASADef | undefined {
		const asaMap = this.cpData.precedingCP[this.networkName]?.asa ?? new Map();
		return asaMap.get(asaName)?.assetDef;
	}

	/**
	 * Loads stateful smart contract info from checkpoint
	 * @param appName name of the app (defined by user during deployment)
	 */
	getApp(appName: string): rtypes.AppInfo {
		return this.assertAppExistsInCP(appName);
	}

	/**
	 * Loads logic signature object (contract or delegated) from checkpoint (by lsig name).
	 * Panics if the lsig doesn't exists.
	 * @param lsigName filename or lsigName (defined by user during mkContractLsig/mkDelegatedLsig)
	 */
	getLsig(lsigName: string): LogicSigAccount {
		const resultMap = this.cpData.precedingCP[this.networkName]?.dLsig ?? new Map();
		const result = resultMap.get(lsigName)?.lsig;
		if (result === undefined) {
			throw new BuilderError(ERRORS.GENERAL.LSIG_NOT_FOUND_IN_CP, {
				lsigName: lsigName,
			});
		}

		const lsigAccount = Object.assign(getDummyLsig(), result);
		lsigAccount.lsig = Object.assign(getDummyLsig().lsig, result.lsig);

		if (lsigAccount.lsig.sig) {
			lsigAccount.lsig.sig = Uint8Array.from(lsigAccount.lsig.sig);
		}
		return lsigAccount;
	}

	/**
	 * Loads logic signature for contract mode
	 * @param name ASC name
	 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 * @returns loaded logic signature from assets/<file_name>.teal
	 */
	async loadLogicByFile(name: string, scTmplParams?: SCParams): Promise<LogicSigAccount> {
		return await getLsig(name, this.algoOp.algodClient, scTmplParams);
	}

	/**
	 * Returns ASCCache (with compiled code)
	 * @param name: Smart Contract filename (must be present in assets folder)
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 * @param force: if force is true file will be compiled for sure, even if it's checkpoint exist
	 */
	compileASC(name: string, scTmplParams?: SCParams, force?: boolean): Promise<ASCCache> {
		return this.algoOp.ensureCompiled(name, "", force, scTmplParams);
	}

	/**
	 * Return application in bytes source format
	 * @param appName app name
	 * @param source
	 * @param scTmplParams
	 * @returns application in bytes format
	 */
	compileApplication(
		appName: string,
		source: wtypes.SmartContract,
		scTmplParams?: SCParams
	): Promise<wtypes.SourceCompiled> {
		return this.algoOp.compileApplication(appName, source, scTmplParams);
	}

	/**
	 * Returns cached program (from artifacts/cache) `ASCCache` object by app/lsig name.
	 * @param name App/Lsig name used during deployment
	 */
	async getDeployedASC(name: string): Promise<ASCCache | AppCache | undefined> {
		const op = new CompileOp(this.algoOp.algodClient);

		// app
		const app = this.getApp(name);
		if (app !== undefined) {
			const approvalCache = await op.readArtifact(app.approvalFile);
			const clearCache = await op.readArtifact(app.clearFile);
			return {
				approval: approvalCache,
				clear: clearCache,
			};
		}

		// lsig
		const resultMap = this.cpData.precedingCP[this.networkName]?.dLsig ?? new Map();
		const lsigInfo = resultMap.get(name);
		if (lsigInfo?.file) {
			return await op.readArtifact(lsigInfo.file);
		}

		return undefined;
	}

	/**
	 * Loads multisigned logic signature account from .lsig or .blsig file
	 * @param name filename
	 * @returns multi signed logic signature from assets/<file_name>.(b)lsig
	 */
	async loadMultiSig(name: string): Promise<LogicSig> {
		if (name.endsWith(blsigExt)) {
			return await loadBinaryLsig(name);
		}

		const lsig = (await getLsig(name, this.algoOp.algodClient)).lsig; // get lsig from .teal (getting logic part from lsig)
		const msig = await readMsigFromFile(name); // Get decoded Msig object from .msig
		Object.assign((lsig.msig = {} as EncodedMultisig), msig);
		return lsig;
	}

	/**
	 * Send signed transaction to network and wait for confirmation
	 * @param rawTxns Signed Transaction(s)
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 */
	sendAndWait(
		rawTxns: Uint8Array | Uint8Array[],
		waitRounds = wtypes.WAIT_ROUNDS
	): Promise<ConfirmedTxInfo> {
		return this.algoOp.sendAndWait(rawTxns, waitRounds);
	}

	/**
	 * Opt-In to ASA for a single account. The opt-in transaction is
	 * signed by account secret key
	 * @param asa ASA (name/ID) Note: ID can be used for assets not existing in checkpoints.
	 * @param accountName
	 * @param flags Transaction flags
	 */
	optInAccountToASA(asa: string, accountName: string, flags: wtypes.TxParams): Promise<void> {
		this.assertCPNotDeleted({
			type: wtypes.TransactionType.OptInASA,
			sign: wtypes.SignType.SecretKey,
			fromAccount: this._getAccount(accountName),
			assetID: asa,
			payFlags: {},
		});
		let asaId = 0;
		try {
			asaId = this.getASAInfo(asa).assetIndex;
		} catch (error) {
			if (!Number(asa)) {
				throw Error("Please provide a valid Number to be used as ASA ID");
			}
			asaId = Number(asa);
		}
		return this.algoOp.optInAccountToASA(asa, asaId, this._getAccount(accountName), flags);
	}

	/**
	 * Description: Opt-In to ASA for a contract account (represented by logic signture).
	 * The opt-in transaction is signed by the logic signature
	 * @param asa ASA (name/ID) Note: ID can be used for assets not existing in checkpoints.
	 * @param lsig logic signature
	 * @param flags Transaction flags
	 */
	optInLsigToASA(asa: string, lsig: LogicSigAccount, flags: wtypes.TxParams): Promise<void> {
		this.assertCPNotDeleted({
			type: wtypes.TransactionType.OptInASA,
			sign: wtypes.SignType.LogicSignature,
			fromAccountAddr: lsig.address(),
			lsig: lsig,
			assetID: asa,
			payFlags: {},
		});
		let asaId = 0;
		try {
			asaId = this.getASAInfo(asa).assetIndex;
		} catch (error) {
			if (!Number(asa)) {
				throw Error("Please provide a valid Number to be used as ASA ID");
			}
			asaId = Number(asa);
		}
		return this.algoOp.optInLsigToASA(asa, asaId, lsig, flags);
	}

	/**
	 * Opt-In to stateful smart contract (SSC) for a single account
	 * signed by account secret key
	 * @param sender sender account
	 * @param appID application index
	 * @param payFlags Transaction flags
	 * @param flags Optional parameters to SSC (accounts, args..)
	 */
	optInAccountToApp(
		sender: rtypes.Account,
		appID: number,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		this.assertCPNotDeleted({
			type: wtypes.TransactionType.OptInToApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: sender,
			appID: appID,
			payFlags: {},
		});
		return this.algoOp.optInAccountToApp(sender, appID, payFlags, flags);
	}

	/**
	 * Opt-In to stateful smart contract (SSC) for a contract account
	 * The opt-in transaction is signed by the logic signature
	 * @param appID application index
	 * @param lsig logic signature
	 * @param payFlags Transaction flags
	 * @param flags Optional parameters to SSC (accounts, args..)
	 */
	optInLsigToApp(
		appID: number,
		lsig: LogicSigAccount,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		this.assertCPNotDeleted({
			type: wtypes.TransactionType.OptInToApp,
			sign: wtypes.SignType.LogicSignature,
			fromAccountAddr: lsig.address(),
			lsig: lsig,
			appID: appID,
			payFlags: {},
		});
		return this.algoOp.optInLsigToApp(appID, lsig, payFlags, flags);
	}

	/**
	 * Asserts ASA is defined in a checkpoint by asset id / string,
	 * First: search for ASAInfo in checkpoints
	 * Case 1: If it exist check if that info is deleted or not by checking deleted boolean
	 * If deleted boolean is true throw error
	 * else, pass
	 * Case 2: If it doesn't exist, pass
	 * @param asset asset index or asset name
	 */
	private assertASAExist(asset: string | number): void {
		let key, res;
		if (typeof asset === "string") {
			res = this.asa.get(asset);
		} else if (typeof asset === "number") {
			key = this.checkpoint.getAssetCheckpointKeyFromIndex(asset);
			res = key ? this.asa.get(key) : undefined;
		}
		if (res?.deleted === true) {
			throw new BuilderError(ERRORS.GENERAL.ASSET_DELETED, {
				asset: asset,
			});
		}
	}

	/**
	 * Asserts App is defined in a checkpoint by app id.
	 * First: search for AppInfo in checkpoints
	 * Case 1: If it exist check if that info is deleted or not by checking deleted boolean
	 * If deleted boolean is true throw error
	 * else, pass
	 * Case 2: If it doesn't exist, pass
	 * @param appID Application index
	 */
	private assertAppExist(appID: number): void {
		const key = this.checkpoint.getAppCheckpointKeyFromIndex(appID);
		const res = key ? this.checkpoint.getAppfromCPKey(key) : undefined;
		if (res?.deleted) {
			throw new BuilderError(ERRORS.GENERAL.APP_DELETED, {
				app: appID,
			});
		}
	}

	/**
	 * Group transactions into asa and app, check for cp deletion
	 * @param txn Transaction execution parameter
	 */
	private _assertCpNotDeleted(txn: wtypes.ExecParams): void {
		switch (txn.type) {
			case wtypes.TransactionType.ModifyAsset:
			case wtypes.TransactionType.FreezeAsset:
			case wtypes.TransactionType.RevokeAsset:
			case wtypes.TransactionType.OptInASA:
			case wtypes.TransactionType.DestroyAsset: {
				this.assertASAExist(txn.assetID);
				break;
			}
			// https://developer.algorand.org/articles/algos-asas/#opting-in-and-out-of-asas
			// https://developer.algorand.org/docs/reference/transactions/#asset-transfer-transaction
			case wtypes.TransactionType.TransferAsset: {
				// If transaction is not opt-out check for CP deletion
				if (txn.payFlags.closeRemainderTo === undefined) {
					this.assertASAExist(txn.assetID);
				}
				break;
			}
			case wtypes.TransactionType.DeleteApp:
			case wtypes.TransactionType.CloseApp:
			case wtypes.TransactionType.OptInToApp:
			case wtypes.TransactionType.UpdateApp:
			case wtypes.TransactionType.CallApp: {
				this.assertAppExist(txn.appID);
				break;
			}
		}
	}

	/**
	 * Checks if checkpoint is deleted for a particular transaction
	 * if checkpoint exist and is marked as deleted,
	 * throw error(except for opt-out transactions), else pass
	 * @param execParams Transaction execution parameters
	 */
	assertCPNotDeleted(execParams: wtypes.ExecParams | wtypes.ExecParams[]): void {
		if (Array.isArray(execParams)) {
			for (const txn of execParams) {
				this._assertCpNotDeleted(txn);
			}
		} else {
			this._assertCpNotDeleted(execParams);
		}
	}

	/**
	 * Throws error if application info is not present in CP
	 * @param key key against which app information is stored in checkpoint
	 */
	assertAppExistsInCP(key: string): rtypes.AppInfo {
		const app = this.checkpoint.getAppfromCPKey(key);
		if (app === undefined) {
			throw new BuilderError(ERRORS.GENERAL.APP_NOT_FOUND_IN_CP, {
				appName: app,
			});
		}
		return app;
	}

	/**
	 * Return receipts for each transaction in group txn
	 * @param txns list transaction in group
	 * @returns confirmed tx info of group
	 */
	async getReceiptTxns(txns: Transaction[]): Promise<TxnReceipt[]> {
		return await this.algoOp.getReceiptTxns(txns);
	}
}
/**
 * This class is what user interacts with in deploy task
 */
export class DeployerDeployMode extends DeployerBasicMode implements Deployer {
	get isDeployMode(): boolean {
		return true;
	}

	addCheckpointKV(key: string, value: string): void {
		const found = this.cpData.getMetadata(this.networkName, key);
		if (found === value) {
			return;
		}
		if (found) {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_METADATA_ALREADY_PRESENT, {
				metadataKey: key,
			});
		}
		this.cpData.putMetadata(this.networkName, key, value);
	}

	/**
	 * Asserts if asset is not already present in checkpoint
	 * @param name Asset name
	 */
	assertNoAsset(name: string): void {
		if (this.isDefined(name)) {
			this.persistCP();
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT, {
				assetName: name,
			});
		}
	}

	/**
	 * Asserts if lsig is not already present in checkpoint
	 * @param lsigName lsig name
	 */
	assertNoLsig(lsigName: string): void {
		if (this.isDefined(lsigName)) {
			this.persistCP();
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_LSIG_ALREADY_PRESENT, {
				lsigName: lsigName,
			});
		}
	}

	/**
	 * Asserts if app is not already present in checkpoint
	 * @param appName app name
	 */
	assertNoApp(appName: string): void {
		if (this.isDefined(appName)) {
			this.persistCP();
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_APP_ALREADY_PRESENT, {
				appName: appName,
			});
		}
	}

	/**
	 * Persist checkpoint till current call.
	 */
	persistCP(): void {
		persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);
	}

	/**
	 * Register ASA Info in checkpoints
	 */
	registerASAInfo(asaName: string, asaInfo: rtypes.ASAInfo): void {
		this.cpData.registerASA(this.networkName, asaName, asaInfo);
	}

	/**
	 * Register SSC Info in checkpoints
	 */
	registerSSCInfo(sscName: string, sscInfo: rtypes.AppInfo): void {
		this.cpData.registerSSC(this.networkName, sscName, sscInfo);
	}

	/**
	 * Log transaction with message using txwriter
	 */
	logTx(message: string, txConfirmation: ConfirmedTxInfo): void {
		this.txWriter.push(message, txConfirmation);
	}

	/**
	 * Creates and deploys ASA using asa.yaml.
	 * @name  ASA name - deployer will search for the ASA in the /assets/asa.yaml file
	 * @flags  deployment flags
	 */
	async deployASA(
		name: string,
		flags: rtypes.ASADeploymentFlags,
		asaParams?: Partial<wtypes.ASADef>
	): Promise<rtypes.ASAInfo> {
		const asaDef = overrideASADef(this.accountsByName, this.loadedAsaDefs[name], asaParams);

		if (asaDef === undefined) {
			this.persistCP();

			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_DEF_NOT_FOUND, {
				asaName: name,
			});
		}
		return await this.deployASADef(name, asaDef, flags);
	}

	/**
	 * Creates and deploys ASA without using asa.yaml.
	 * @name ASA name
	 * @asaDef ASA definitions
	 * @flags deployment flags
	 */
	async deployASADef(
		name: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags
	): Promise<rtypes.ASAInfo> {
		this.assertNoAsset(name);
		parseASADef(asaDef);
		validateOptInAccNames(this.accountsByName, asaDef);
		let asaInfo = {} as rtypes.ASAInfo;
		try {
			asaInfo = await this.algoOp.deployASA(
				name,
				asaDef,
				flags,
				this.accountsByName,
				this.txWriter
			);
		} catch (error) {
			this.persistCP();

			console.error(error);
			throw error;
		}

		this.registerASAInfo(name, asaInfo);

		try {
			await this.algoOp.optInToASAMultiple(
				name,
				asaDef,
				flags,
				this.accountsByName,
				asaInfo.assetIndex
			);
		} catch (error) {
			this.persistCP();

			console.error(error);
			throw error;
		}

		return asaInfo;
	}

	/**
	 * This function will send Algos to ASC account in "Contract Mode"
	 * @param fileName     - ASC filename
	 * @param flags    - Deployments flags (as per SPEC)
	 * @param payFlags - as per SPEC
	 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 */
	async fundLsigByFile(
		fileName: string,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams,
		scTmplParams?: SCParams
	): Promise<void> {
		try {
			await this.algoOp.fundLsig(fileName, flags, payFlags, this.txWriter, scTmplParams);
		} catch (error) {
			console.error(error);
			throw error;
		}
	}

	/**
	 * This function will send Algos to ASC account in "Contract Mode". Takes lsig name
	 * as input
	 * @param lsigName - name of the smart signature (defined by user during mkContractLsig/mkDelegatedLsig)
	 * @param flags    - Deployments flags (as per SPEC)
	 * @param payFlags - as per SPEC
	 */
	async fundLsig(
		lsigName: string,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams
	): Promise<void> {
		try {
			const lsig = this.getLsig(lsigName);
			await this.algoOp.fundLsig(lsig, flags, payFlags, this.txWriter);
		} catch (error) {
			console.error(error);
			throw error;
		}
	}

	/**
	 * Create and sign (using signer's sk) a logic signature for "delegated approval". Then save signed lsig
	 * info to checkpoints (in /artifacts)
	 * @param name: Logic Signature filename (must be present in assets folder)
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 * @param signer: Signer Account which will sign the smart
	 * contract(optional in case of contract account)
	 * @param lsigName name of lsig (if passed, checkpoint info will be stored against this name)
	 */
	async _mkLsig(
		fileName: string,
		scTmplParams?: SCParams,
		signer?: rtypes.Account,
		lsigName?: string
	): Promise<LsigInfo> {
		const cpLsigName = lsigName ?? fileName;
		this.assertNoLsig(cpLsigName);
		let lsigInfo = {} as any;
		try {
			const lsig = await getLsig(fileName, this.algoOp.algodClient, scTmplParams);
			if (signer) {
				lsig.sign(signer.sk);
				lsigInfo = {
					creator: signer.addr,
					contractAddress: lsig.address(),
					lsig: lsig,
					file: fileName,
				};
			} else {
				lsigInfo = {
					creator: lsig.address(),
					contractAddress: lsig.address(),
					lsig: lsig,
					file: fileName,
				};
			}
		} catch (error) {
			this.persistCP();

			console.error(error);
			throw error;
		}

		this.cpData.registerLsig(this.networkName, cpLsigName, lsigInfo);
		return lsigInfo;
	}

	/**
	 * Create and sign (using signer's sk) a logic signature for "delegated approval". Then save signed lsig
	 * info to checkpoints (in /artifacts)
	 * https://developer.algorand.org/docs/features/asc1/stateless/sdks/#account-delegation-sdk-usage
	 * @param lsigName name of smart signature (checkpoint info will be stored against this name)
	 * @param fileName: Logic Signature filename (must be present in assets folder)
	 * @param signer: Signer Account which will sign the smart contract
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 */
	async mkDelegatedLsig(
		lsigName: string,
		fileName: string,
		signer: rtypes.Account,
		scTmplParams?: SCParams
	): Promise<LsigInfo> {
		return await this._mkLsig(fileName, scTmplParams, signer, lsigName);
	}

	/**
	 * Stores logic signature info in checkpoint for contract mode
	 * @param lsigName name of lsig (checkpoint info will be stored against this name)
	 * @param fileName ASC file name
	 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 */
	async mkContractLsig(
		lsigName: string,
		fileName: string,
		scTmplParams?: SCParams
	): Promise<LsigInfo> {
		return await this._mkLsig(fileName, scTmplParams, undefined, lsigName);
	}

	/**
	 * Deploys Algorand Stateful Smart Contract
	 * @param payFlags Transaction Params
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 * the checkpoint "key", and app information will be associated with this name
	 */
	async deployApp(
		creator: Account,
		appDefinition: wtypes.AppDefinition,
		payFlags: wtypes.TxParams,
		scTmplParams?: SCParams
	): Promise<rtypes.AppInfo> {
		const name = appDefinition.appName;

		this.assertNoApp(name);
		let sscInfo = {} as rtypes.AppInfo;
		try {
			sscInfo = await this.algoOp.deployApp(
				creator,
				appDefinition,
				payFlags,
				this.txWriter,
				scTmplParams
			);
		} catch (error) {
			this.persistCP();

			console.error(error);
			throw error;
		}

		this.registerSSCInfo(name, sscInfo);
		return sscInfo;
	}

	/**
	 * Update programs for a contract.
	 * @param sender Account from which call needs to be made
	 * @param payFlags Transaction Flags
	 * @param appID ID of the application being configured or empty if creating
	 * @param newAppCode new source of application
	 * @param flags Optional parameters to SSC (accounts, args..)
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 * @param appName name of the app to deploy. This name (if passed) will be used as
	 * the checkpoint "key", and app information will be associated with this name
	 */
	async updateApp(
		appName: string,
		sender: algosdk.Account,
		payFlags: wtypes.TxParams,
		appID: number,
		newAppCode: wtypes.SmartContract,
		flags: rtypes.AppOptionalFlags,
		scTmplParams?: SCParams
	): Promise<rtypes.AppInfo> {
		this.assertCPNotDeleted({
			type: wtypes.TransactionType.UpdateApp,
			sign: wtypes.SignType.SecretKey,
			appName,
			fromAccount: sender,
			newAppCode,
			appID: appID,
			payFlags: {},
		});
		const cpKey = appName;

		let sscInfo = {} as rtypes.AppInfo;
		try {
			sscInfo = await this.algoOp.updateApp(
				appName,
				sender,
				payFlags,
				appID,
				newAppCode,
				flags,
				this.txWriter,
				scTmplParams
			);
		} catch (error) {
			this.persistCP();

			console.error(error);
			throw error;
		}

		this.registerSSCInfo(cpKey, sscInfo);
		return sscInfo;
	}
	/**
	 * Execute single transaction or group of transactions (atomic transaction)
	 * executes `ExecParams` or `Transaction` Object, SDK Transaction object passed to this function
	 * will be signed and sent to network. User can use SDK functions to create transactions.
	 * Note: If passing transaction object a signer/s must be provided.
	 * @param transactions transaction parameters or atomic transaction parameters
	 * https://github.com/scale-it/algo-builder/blob/docs/docs/guide/execute-transaction.md
	 * or TransactionAndSign object(SDK transaction object and signer parameters).
	 * If `ExecParams` are used, the deployer will connect to appropriate accounts / wallets to sign
	 * constructed transactions.
	 */
	async executeTx(
		transactions: wtypes.ExecParams[] | wtypes.TransactionAndSign[]
	): Promise<TxnReceipt[]> {
		return await executeTx(this, transactions);
	}
}

/**
 * This class is what user interacts with in run task mode
 */
export class DeployerRunMode extends DeployerBasicMode implements Deployer {
	get isDeployMode(): boolean {
		return false;
	}

	persistCP(): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "persistCP",
		});
	}

	assertNoAsset(name: string): void {
		if (this.isDefined(name)) {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT, {
				assetName: name,
			});
		}
	}

	assertNoLsig(lsigName: string): void {
		if (this.isDefined(lsigName)) {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_LSIG_ALREADY_PRESENT, {
				lsigName: lsigName,
			});
		}
	}

	assertNoApp(appName: string): void {
		if (this.isDefined(appName)) {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_APP_ALREADY_PRESENT, {
				appName: appName,
			});
		}
	}

	registerASAInfo(name: string, asaInfo: rtypes.ASAInfo): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "registerASAInfo",
		});
	}

	registerSSCInfo(name: string, sscInfo: rtypes.AppInfo): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "registerSSCInfo",
		});
	}

	logTx(message: string, txConfirmation: ConfirmedTxInfo): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "logTx",
		});
	}

	addCheckpointKV(_key: string, _value: string): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "addCheckpointKV",
		});
	}

	async deployASA(_name: string, _flags: rtypes.ASADeploymentFlags): Promise<rtypes.ASAInfo> {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "deployASA",
		});
	}

	async deployASADef(
		name: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags
	): Promise<rtypes.ASAInfo> {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "deployASADef",
		});
	}

	async fundLsigByFile(
		_fileName: string,
		_flags: FundASCFlags,
		_payFlags: wtypes.TxParams,
		_scInitParams?: unknown
	): Promise<LsigInfo> {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "fundLsigByFile",
		});
	}

	async fundLsig(
		_lsigName: string,
		_flags: FundASCFlags,
		_payFlags: wtypes.TxParams
	): Promise<LsigInfo> {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "fundLsig",
		});
	}

	async mkDelegatedLsig(
		_lsigName: string,
		_fileName: string,
		_signer: rtypes.Account,
		_scInitParams?: unknown
	): Promise<LsigInfo> {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "delegatedLsig",
		});
	}

	async mkContractLsig(
		_lsigName: string,
		_fileName: string,
		_scInitParams?: unknown
	): Promise<LsigInfo> {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "mkContractLsig",
		});
	}

	async deployApp(
		creator: algosdk.Account,
		appDefinition: wtypes.AppDefinitionFromFile,
		payFlags: wtypes.TxParams,
		scInitParam?: unknown,
		appName?: string
	): Promise<rtypes.AppInfo> {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
			methodName: "deployApp",
		});
	}

	/**
	 * This functions updates SSC in the network.
	 * Note: updateApp when ran in RunMode it doesn't store checkpoints
	 * @param sender Sender account
	 * @param payFlags transaction parameters
	 * @param appID application index
	 * @param flags SSC optional flags
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 */
	async updateApp(
		appName: string,
		sender: algosdk.Account,
		payFlags: wtypes.TxParams,
		appID: number,
		newAppCode: wtypes.SmartContract,
		flags: rtypes.AppOptionalFlags,
		scTmplParams?: SCParams
	): Promise<rtypes.AppInfo> {
		this.assertCPNotDeleted({
			type: wtypes.TransactionType.UpdateApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: sender,
			appName,
			newAppCode,
			appID: appID,
			payFlags: {},
		});
		return await this.algoOp.updateApp(
			appName,
			sender,
			payFlags,
			appID,
			newAppCode,
			flags,
			this.txWriter,
			scTmplParams
		);
	}
	/**
	 * Execute single transaction or group of transactions (atomic transaction)
	 * executes `ExecParams` or `Transaction` Object, SDK Transaction object passed to this function
	 * will be signed and sent to network. User can use SDK functions to create transactions.
	 * Note: If passing transaction object a signer/s must be provided.
	 * @param transactions transaction parameters or atomic transaction parameters
	 * https://github.com/scale-it/algo-builder/blob/docs/docs/guide/execute-transaction.md
	 * or TransactionAndSign object(SDK transaction object and signer parameters)
	 */
	async executeTx(
		transactions: wtypes.ExecParams[] | wtypes.TransactionAndSign[]
	): Promise<TxnReceipt[]> {
		return await executeTx(this, transactions);
	}
}
