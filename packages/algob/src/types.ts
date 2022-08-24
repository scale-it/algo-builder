import { types as rtypes } from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";
import algosdk, { LogicSigAccount, modelsv2, Transaction } from "algosdk";

import * as types from "./internal/core/params/argument-types";
// Begin config types

// IMPORTANT: This t.types MUST be kept in sync with the actual types.

export type Timestamp = number;

export interface Account {
	name: string;
	mnemonic: string;
}

export interface HDAccount {
	mnemonic: string;
	initialIndex?: number;
	count?: number;
	path: string;
}

export interface MnemonicAccount {
	name: string;
	addr: string;
	mnemonic: string;
}

export type AccountDef = MnemonicAccount | HDAccount | rtypes.Account;

interface CommonNetworkConfig {
	accounts: rtypes.Account[];
	// optional, when provided KMD accounts will be loaded by the config resolver
	// and merged into the accounts variable (above)
	kmdCfg?: KmdCfg;
	indexerCfg?: IndexerCfg;
	chainName?: string;
	// from?: string;
	// TODO: timeout?: number;
}

export interface ChainCfg extends CommonNetworkConfig {
	throwOnTransactionFailures?: boolean;
	throwOnCallFailures?: boolean;
	loggingEnabled?: boolean;
	initialDate?: string;
}

export interface HttpNetworkConfig extends CommonNetworkConfig {
	host: string; // with optional http o https prefix
	port: string | number;
	token: string | AlgodTokenHeader | CustomTokenHeader;
	httpHeaders?: { [name: string]: string };
}

export type NetworkConfig = ChainCfg | HttpNetworkConfig;

export interface Networks {
	[networkName: string]: NetworkConfig;
}

export interface KmdWallet {
	name: string;
	password: string;
	accounts: Array<{ name: string; address: string }>; // both are obligatory
}

export interface KmdCfg {
	host: string;
	port: string | number;
	token: string | KMDTokenHeader | CustomTokenHeader;
	wallets: KmdWallet[];
}

export interface IndexerCfg {
	host: string;
	port: string | number;
	token: string | IndexerTokenHeader | CustomTokenHeader;
}

export interface NetworkCredentials {
	host: string;
	port: string | number;
	token: string;
}

/**
 * TODO: Use js-sdk types
 * https://github.com/algorand/js-algorand-sdk/issues/437
 */
export interface AlgodTokenHeader {
	"X-Algo-API-Token": string;
}

export interface IndexerTokenHeader {
	"X-Indexer-API-Token": string;
}

export interface KMDTokenHeader {
	"X-KMD-API-Token": string;
}

export interface CustomTokenHeader {
	[headerName: string]: string;
}

/**
 * The project paths:
 * * root: the project's root.
 * * configFile: the algob's config filepath.
 * * cache: project's cache directory.
 * * artifacts: artifact's directory.
 * * sources: project's sources directory.
 * * tests: project's tests directory.
 */
export interface ProjectPaths {
	root: string;
	configFile: string;
	cache: string;
	artifacts: string;
	sources: string;
	tests: string;
}

export type UserPaths = Omit<Partial<ProjectPaths>, "configFile">;

export interface Config {
	networks?: Networks;
	paths?: UserPaths;
	mocha?: Mocha.MochaOptions;
}

export interface TaskTestConfig extends Config {
	testFiles: string[];
}

export interface ResolvedConfig extends Config {
	paths?: ProjectPaths;
	networks: Networks;
}

// End config types

/**
 * A function that receives a RuntimeEnv and
 * modify its properties or add new ones.
 */
export type EnvironmentExtender = (env: RuntimeEnv) => void;

export type ConfigExtender = (config: ResolvedConfig, userConfig: Readonly<Config>) => void;

export interface TasksMap {
	[name: string]: TaskDefinition;
}

export interface ConfigurableTaskDefinition {
	setDescription: (description: string) => this;

	setAction: (action: ActionType<TaskArguments>) => this;

	addParam: <T>(
		name: string,
		description?: string,
		defaultValue?: T,
		type?: types.ArgumentType<T>,
		isOptional?: boolean
	) => this;

	addOptionalParam: <T>(
		name: string,
		description?: string,
		defaultValue?: T,
		type?: types.ArgumentType<T>
	) => this;

	addPositionalParam: <T>(
		name: string,
		description?: string,
		defaultValue?: T,
		type?: types.ArgumentType<T>,
		isOptional?: boolean
	) => this;

	addOptionalPositionalParam: <T>(
		name: string,
		description?: string,
		defaultValue?: T,
		type?: types.ArgumentType<T>
	) => this;

	addVariadicPositionalParam: <T>(
		name: string,
		description?: string,
		defaultValue?: T[],
		type?: types.ArgumentType<T>,
		isOptional?: boolean
	) => this;

	addOptionalVariadicPositionalParam: <T>(
		name: string,
		description?: string,
		defaultValue?: T[],
		type?: types.ArgumentType<T>
	) => this;

	addFlag: (name: string, description?: string) => this;
}

export interface ParamDefinition<T> {
	name: string;
	shortName?: string;
	defaultValue?: T;
	type: types.ArgumentType<T>;
	description?: string;
	isOptional: boolean;
	isFlag: boolean;
	isVariadic: boolean;
}

export type ParamDefinitionAny = ParamDefinition<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface OptionalParamDefinition<T> extends ParamDefinition<T> {
	defaultValue: T;
	isOptional: true;
}

export interface ParamDefinitionsMap {
	[paramName: string]: ParamDefinitionAny;
}

/**
 * Algob arguments:
 * + network: the network to be used (default="default").
 * + showStackTraces: flag to show stack traces.
 * + version: flag to show algob's version.
 * + help: flag to show algob's help message.
 * + config: used to specify algob's config file.
 */
export interface RuntimeArgs {
	network: string;
	showStackTraces: boolean;
	version: boolean;
	help: boolean;
	config?: string;
	verbose: boolean;
}

export type ParamDefinitions = {
	[param in keyof Required<RuntimeArgs>]: OptionalParamDefinition<RuntimeArgs[param]>;
};

export interface ShortParamSubstitutions {
	[name: string]: string;
}

export interface TaskDefinition extends ConfigurableTaskDefinition {
	readonly name: string;
	readonly description?: string;
	readonly action: ActionType<TaskArguments>;
	readonly isInternal: boolean;

	// TODO: Rename this to something better. It doesn't include the positional
	// params, and that's not clear.
	readonly paramDefinitions: ParamDefinitionsMap;

	readonly positionalParamDefinitions: ParamDefinitionAny[];
}

/**
 * @type TaskArguments {object-like} - the input arguments for a task.
 *
 * TaskArguments type is set to 'any' because it's interface is dynamic.
 * It's impossible in TypeScript to statically specify a variadic
 * number of fields and at the same time define specific types for\
 * the argument values.
 *
 * For example, we could define:
 * type TaskArguments = Record<string, any>;
 *
 * ...but then, we couldn't narrow the actual argument value's type in compile time,
 * thus we have no other option than forcing it to be just 'any'.
 */
export type TaskArguments = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type RunTaskFunction = (name: string, taskArguments?: TaskArguments) => PromiseAny;

export interface RunSuperFunction<ArgT extends TaskArguments> {
	(taskArguments?: ArgT): PromiseAny;
	isDefined: boolean;
}

export type ActionType<ArgsT extends TaskArguments> = (
	taskArgs: ArgsT,
	env: RuntimeEnv,
	runSuper: RunSuperFunction<ArgsT>
) => PromiseAny;

export interface Network {
	name: string;
	config: NetworkConfig;
	// provider:
}

export interface RuntimeEnv {
	readonly config: ResolvedConfig;
	readonly runtimeArgs: RuntimeArgs;
	readonly tasks: TasksMap;
	readonly run: RunTaskFunction;
	readonly network: Network;
}

export interface Artifact {
	contractName: string;
	abi: any; // eslint-disable-line @typescript-eslint/no-explicit-any
	bytecode: string; // "0x"-prefixed hex string
	deployedBytecode: string; // "0x"-prefixed hex string
	linkReferences: LinkReferences;
	deployedLinkReferences: LinkReferences;
}

export interface LinkReferences {
	[libraryFileName: string]: {
		[libraryName: string]: Array<{ length: number; start: number }>;
	};
}

export type AccountAddress = string;

// smart signature deployment information (log)
export interface LsigInfo {
	creator: AccountAddress;
	contractAddress: string;
	lsig: LogicSigAccount;
	file?: string;
}

/**
 * Checkpoint implementation
 */
export interface CheckpointRepo {
	/**
	 * Accumulates state as scripts are executed. This way it hides values generated by
	 * remaining checkpoints. It is what should be exposed to the running scripts. */
	precedingCP: Checkpoints;
	/**
	 * Variables that current script introduced, short version of what was added.
	 * Used for state persistence. */
	strippedCP: Checkpoints;
	/**
	 * All possible values that are loaded in advance.
	 * This allows to prevent asset name clashes between scripts. */
	allCPs: Checkpoints;

	merge: (c: Checkpoints, scriptName: string) => CheckpointRepo;
	mergeToGlobal: (c: Checkpoints, scriptName: string) => CheckpointRepo;

	/**
	 * Sets metadata key-value for a specified network. */
	putMetadata: (networkName: string, key: string, value: string) => CheckpointRepo;
	/**
	 * Gets metadata key-value for a specified network. */
	getMetadata: (networkName: string, key: string) => string | undefined;

	registerASA: (networkName: string, name: string, info: rtypes.ASAInfo) => CheckpointRepo;
	registerSSC: (networkName: string, name: string, info: rtypes.AppInfo) => CheckpointRepo;
	registerLsig: (networkName: string, name: string, info: LsigInfo) => CheckpointRepo;

	isDefined: (networkName: string, name: string) => boolean;
	networkExistsInCurrentCP: (networkName: string) => boolean;
}

export interface Checkpoints {
	[network: string]: Checkpoint;
}

export interface Checkpoint {
	timestamp: number;
	metadata: Map<string, string>;
	asa: Map<string, rtypes.ASAInfo>;
	app: Map<string, Map<Timestamp, rtypes.AppInfo>>;
	dLsig: Map<string, LsigInfo>;
}

export interface FundASCFlags {
	funder: rtypes.Account;
	fundingMicroAlgo: number;
}

export interface AssetScriptMap {
	[assetName: string]: string;
}

export interface CheckpointFunctions {
	/**
	 * Queries a stateful smart contract info from checkpoint using key. */
	getAppfromCPKey: (key: string) => rtypes.AppInfo | undefined;

	/**
	 * Returns SSC checkpoint key using application index,
	 * returns undefined if it doesn't exist
	 * @param index Application index
	 */
	getAppCheckpointKeyFromIndex: (index: number) => string | undefined;

	/**
	 * Returns ASA checkpoint key using asset index,
	 * returns undefined if it doesn't exist
	 * @param index Asset Index
	 */
	getAssetCheckpointKeyFromIndex: (index: number) => string | undefined;

	getLatestTimestampValue: (map: Map<number, rtypes.AppInfo>) => number;
}

export interface Deployer {
	/**
	 * Allows user to know whether a script is running in a `deploy` or `run` mode. */
	isDeployMode: boolean;
	accounts: rtypes.Account[];
	accountsByName: rtypes.AccountMap;

	/**
	 * Mapping of ASA name to deployment log */
	asa: Map<string, rtypes.ASAInfo>;

	checkpoint: CheckpointFunctions;

	getASAInfo: (name: string) => rtypes.ASAInfo;

	/**
	 * Sets metadata key value for a current network in the chckpoint file based on the
	 * current deployment script. If run in a non deployment mode (eg `algob run script_name.js`)
	 * it will throw an exception. */
	addCheckpointKV: (key: string, value: string) => void;

	/**
	 * Queries metadata key in all checkpoint files of current network. If the key is not defined
	 * in any checkpoint then `undefined` is returned. Can be run in both _run_ and _deploy_ mode.
	 */
	getCheckpointKV: (key: string) => string | undefined;

	/**
	 * Creates and deploys ASA defined in asa.yaml.
	 * @name  ASA name - deployer will search for the ASA in the /assets/asa.yaml file
	 * @flags  deployment flags. Required.
	 *   `flags.creator` must be defined - it's an account which will sign the constructed transaction.
	 * NOTE: support for rekeyed accounts is limited (creator must have updated sk to properly sign
	 * transaction) */
	deployASA: (
		name: string,
		flags: rtypes.ASADeploymentFlags,
		asaParams?: Partial<wtypes.ASADef>
	) => Promise<rtypes.ASAInfo>;

	/**
	 * Creates and deploys ASA without using asa.yaml.
	 * @name ASA name
	 * @asaDef ASA definitions
	 * @flags deployment flags
	 *   `flags.creator` must be defined - it's an account which will sign the constructed transaction.
	 * NOTE: support for rekeyed accounts is limited (creator must have updated sk to properly sign
	 * transaction) */
	deployASADef: (
		name: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags
	) => Promise<rtypes.ASAInfo>;

	/**
	 * Loads deployed asset definition from checkpoint.
	 * NOTE: This function returns "deployed" ASADef, as immutable properties
	 * of asaDef could be updated during tx execution (eg. update asset clawback)
	 * @name  ASA name - name of ASA in the /assets/asa.yaml file */
	loadASADef: (asaName: string) => wtypes.ASADef | undefined;

	assertNoAsset: (name: string) => void;
	assertNoLsig: (lsigName: string) => void;
	assertNoApp: (appName: string) => void;

	getASADef: (name: string, asaParams?: Partial<wtypes.ASADef>) => wtypes.ASADef;

	persistCP: () => void;

	registerASAInfo: (name: string, asaInfo: rtypes.ASAInfo) => void;

	registerSSCInfo: (name: string, sscInfo: rtypes.AppInfo) => void;

	logTx: (message: string, txConfirmation: ConfirmedTxInfo) => void;

	/**
	 * Send signed transaction to network and wait for confirmation
	 * @param rawTxns Signed Transaction(s)
	 */
	sendAndWait: (rawTxns: Uint8Array | Uint8Array[]) => Promise<ConfirmedTxInfo>;

	/**
	 * Return receipts for each transaction in group txn
	 * @param txns list transaction in group
	 * @returns confirmed tx info of group
	 */
	getReceiptTxns: (txns: Transaction[]) => Promise<TxnReceipt[]>;

	/**
	 * Funds logic signature account (Contract Account).
	 * @fileName:  filename with a Smart Signature code (must be present in the assets folder)
	 * @payFlags  Transaction Parameters
	 * @scTmplParams  Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 */
	fundLsigByFile: (
		fileName: string,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams,
		scTmplParams?: SCParams
	) => void;

	/**
	 * This function will send Algos to ASC account in "Contract Mode".
	 * @param lsigName - name of the smart signature (passed by user during
	 * mkContractLsig/mkDelegatedLsig)
	 * @param flags    - Deployments flags (as per SPEC)
	 * @param payFlags - as per SPEC
	 */
	fundLsig: (lsigName: string, flags: FundASCFlags, payFlags: wtypes.TxParams) => void;

	/**
	 * Makes delegated logic signature signed by the `signer`.
	 * @lsigName name of smart signature (checkpoint info will be stored against this name)
	 * @fileName  Smart Signature filename (must be present in assets folder)
	 * @signer  Signer Account which will sign the smart contract
	 * @scTmplParams  Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 */
	mkDelegatedLsig: (
		lsigName: string,
		fileName: string,
		signer: rtypes.Account,
		scTmplParams?: SCParams
	) => Promise<LsigInfo>;

	/**
	 * Stores logic signature info in checkpoint for contract mode
	 * @lsigName name of lsig (checkpoint info will be stored against this name)
	 * @fileName ASC file name
	 * @scTmplParams : Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 */
	mkContractLsig: (
		lsigName: string,
		fileName: string,
		scTmplParams?: SCParams
	) => Promise<LsigInfo>;

	/**
	 * Deploys stateful smart contract.
	 * @creator is the signer of the transaction.
	 * @appDefinition is an object providing details about approval and clear program.
	 * @clearProgram  clear program filename (must be present in assets folder)
	 * @flags  AppDeploymentFlags
	 * @payFlags  Transaction Parameters
	 * @scTmplParams  Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 * @appName name of the app to deploy. This name (if passed) will be used as
	 * the checkpoint "key", and app information will be stored agaisnt this name
	 */
	deployApp: (
		creator: algosdk.Account,
		appDefinition: wtypes.AppDefinitionFromFile,
		payFlags: wtypes.TxParams,
		scTmplParams?: SCParams,
		appName?: string
	) => Promise<rtypes.AppInfo>;

	/**
	 * Update programs(approval, clear) for a stateful smart contract.
	 * @param sender Account from which call needs to be made
	 * @param payFlags Transaction Flags
	 * @param appID ID of the application being configured or empty if creating
	 * @param newApprovalProgram New Approval Program filename
	 * @param newClearProgram New Clear Program filename
	 * @param flags Optional parameters to SSC (accounts, args..)
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 * @param appName name of the app to deploy. This name (if passed) will be used as
	 * the checkpoint "key", and app information will be stored agaisnt this name
	 */
	updateApp: (
		appName: string,
		sender: algosdk.Account,
		payFlags: wtypes.TxParams,
		appID: number,
		newAppCode: wtypes.SmartContract,
		flags: rtypes.AppOptionalFlags,
		scTmplParams?: SCParams
	) => Promise<rtypes.AppInfo>;

	/**
	 * Returns true if ASA or DelegatedLsig or SSC were deployed in any script.
	 * Checks even for checkpoints which are out of scope from the execution
	 * session and are not obtainable using get methods.
	 */
	isDefined: (name: string) => boolean;

	algodClient: algosdk.Algodv2;

	/**
	 * Queries blockchain for a given transaction and waits until it will be processed. */
	waitForConfirmation: (txId: string) => Promise<ConfirmedTxInfo>;

	/**
	 * Queries blockchain using algodv2 for asset information by index  */
	getAssetByID: (assetIndex: number | bigint) => Promise<modelsv2.Asset>;

	/**
	 * Creates an opt-in transaction for given ASA name, which must be defined in
	 * `/assets/asa.yaml` file. The opt-in transaction is signed by the account secret key */
	optInAccountToASA: (
		asa: string,
		accountName: string,
		flags: wtypes.TxParams
	) => Promise<void>;

	/**
	 * Creates an opt-in transaction for given ASA name, which must be defined in
	 * `/assets/asa.yaml` file. The opt-in transaction is signed by the logic signature */
	optInLsigToASA: (asa: string, lsig: LogicSigAccount, flags: wtypes.TxParams) => Promise<void>;

	/**
	 * Opt-In to stateful smart contract (SSC) for a single account
	 * signed by account secret key
	 * @param sender sender account
	 * @param appID application index
	 * @param payFlags Transaction flags
	 * @param flags Optional parameters to SSC (accounts, args..)
	 */
	optInAccountToApp: (
		sender: rtypes.Account,
		appID: number,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	) => Promise<void>;

	/**
	 * Opt-In to stateful smart contract (SSC) for a contract account
	 * The opt-in transaction is signed by the logic signature
	 * @param sender sender account
	 * @param appID application index
	 * @param payFlags Transaction flags
	 * @param flags Optional parameters to SSC (accounts, args..)
	 */
	optInLsigToApp: (
		appID: number,
		lsig: LogicSigAccount,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	) => Promise<void>;

	/**
	 * Create an entry in a script log (stored in artifacts/scripts/<script_name>.log) file. */
	log: (msg: string, obj: any) => void;

	/**
	 * Extracts multi signed logic signature file from `assets/`. */
	loadMultiSig: (name: string) => Promise<LogicSig>;

	/**
	 * Queries a stateful smart contract info from checkpoint name
	 * passed by user during deployment */
	getApp: (appName: string) => rtypes.AppInfo;

	/**
	 * Loads logic signature info(contract or delegated) from checkpoint (by lsig name)
	 * @param lsigName name of the smart signture
	 * (defined by user during mkContractLsig/mkDelegatedLsig)
	 */
	getLsig: (lsigName: string) => LogicSigAccount;

	/**
	 * Loads contract mode logic signature (TEAL or PyTEAL)
	 * @name   Smart Contract filename (must be present in assets folder)
	 * @scTmplParams  Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 */
	loadLogicByFile: (name: string, scTmplParams?: SCParams) => Promise<LogicSigAccount>;

	/**
	 * Returns ASCCache (with compiled code)
	 * @param name: Smart Contract filename (must be present in assets folder)
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 * @param force: if force is true file will be compiled for sure, even if it's checkpoint exist
	 */
	compileASC: (name: string, scTmplParams?: SCParams, force?: boolean) => Promise<ASCCache>;

	compileApplication: (
		appName: string,
		source: wtypes.SmartContract,
		scTmplParams?: SCParams
	) => Promise<wtypes.SourceCompiled>;

	/**
	 * Returns cached program (from artifacts/cache) `ASCCache` object by app/lsig name.
	 * @param name App/Lsig name used during deployment
	 */
	getDeployedASC: (name: string) => Promise<ASCCache | AppCache | undefined>;

	/**
	 * Checks if checkpoint is deleted for a particular transaction
	 * if checkpoint exists and is marked as deleted,
	 * throw error(except for opt-out transactions), else pass
	 * @param execParams Transaction execution parameters
	 */
	assertCPNotDeleted: (execParams: wtypes.ExecParams | wtypes.ExecParams[]) => void;

	/** Execute single transaction or group of transactions (atomic transaction)
	 * executes `ExecParams` or `Transaction` Object, SDK Transaction object passed to this function
	 * will be signed and sent to network. User can use SDK functions to create transactions.
	 * Note: If passing transaction object a signer/s must be provided.
	 * Check out {@link https://algobuilder.dev/guide/execute-transaction.html#execute-transaction|execute-transaction}
	 * for more info.
	 * @param transactions transaction parameters or atomic transaction parameters
	 * https://github.com/scale-it/algo-builder/blob/docs/docs/guide/execute-transaction.md
	 * or TransactionAndSign object(SDK transaction object and signer parameters)
	 */
	executeTx: (
		transactions: wtypes.ExecParams[] | wtypes.TransactionAndSign[]
	) => Promise<TxnReceipt[]>;
}

// ************************
//     Asset types

export interface ASCCache {
	filename: string;
	timestamp: number; // compilation time (Unix time)
	compiled: string; // the compiled code
	compiledHash: string; // hash returned by the compiler
	srcHash: number; // source code hash
	base64ToBytes: Uint8Array; // compiled base64 in bytes
	tealCode: string;
	scParams: SCParams;
}

export interface AppCache {
	approval: ASCCache | undefined;
	clear: ASCCache | undefined;
}

// ************************
//     helper types

export type StateValue = string | number | bigint;

export type Key = string;

export interface StrMap {
	[key: string]: string;
}

export interface SCParams {
	[key: string]: string | bigint;
}

export interface AnyMap {
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type PromiseAny = Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

//  LocalWords:  configFile
export type LogicSig = LogicSigAccount["lsig"];

export interface DebuggerContext {
	tealFile?: string;
	scInitParam?: SCParams; // if tealfile is ".py"
	groupIndex?: number;
	mode?: rtypes.ExecutionMode;
}

// TODO: Remove when this is resolved https://discord.com/channels/491256308461207573/631209194967531559/869677444242739220
export interface ConfirmedTxInfo {
	"confirmed-round": number;
	"asset-index": number;
	"application-index": number;
	"global-state-delta"?: algosdk.modelsv2.EvalDeltaKeyValue;
	"local-state-delta"?: algosdk.modelsv2.AccountStateDelta;
	"inner-txns"?: ConfirmedTxInfo;
	txn: algosdk.EncodedSignedTransaction;
}

export interface TxnReceipt extends ConfirmedTxInfo {
	txID: string;
}
