/* eslint-disable no-unused-vars */

import { types } from "@algo-builder/web";
import algosdk, {
	Account as AccountSDK,
	EncodedTransaction,
	modelsv2,
	Transaction,
} from "algosdk";

import {
	Add,
	Addr,
	Arg,
	Byte,
	Bytec,
	Bytecblock,
	Div,
	Int,
	Len,
	Mul,
	Pragma,
	Sub,
} from "./interpreter/opcode-list";
import { TxnFields } from "./lib/constants";
import type { IStack } from "./lib/stack";

export type AppArgs = Array<string | number>;

export type StackElem = bigint | Uint8Array;
export type TEALStack = IStack<bigint | Uint8Array>;

export interface EncTx extends EncodedTransaction {
	txID: string;
	// user should push raw string TEAL code - not compiled code
	// for approvalProgram and clearProgram
	metaType?: types.MetaType;
	approvalProgram?: string;
	clearProgram?: string;
}

export type TxField = keyof typeof TxnFields[2];

export enum TxnType {
	unknown = "0", // Unknown type. Invalid transaction
	pay = "1", // Payment
	keyreg = "2", // KeyRegistration
	acfg = "3", // AssetConfig
	axfer = "4", // AssetTransfer
	afrz = "5", // AssetFreeze
	appl = "6", // ApplicationCall
}

export enum GlobalField {
	MinTxnFee, // micro Algos
	MinBalance, // micro Algos
	MaxTxnLife, // rounds
	ZeroAddress, // 32 byte address of all zero bytes
	GroupSize, // Number of transactions in this atomic transaction group. At least 1
	LogicSigVersion, // Maximum supported TEAL version.
	Round, // Current round number
	LatestTimestamp, // Last confirmed block UNIX timestamp. Fails if negative.
	CurrentApplicationID, // ID of current application executing. Fails if no such application is executing.
}

export enum EncodingType {
	BASE64,
	BASE32,
	HEX,
	UTF8,
}

export type AccountAddress = string;

export type ID = number; // Asset or Application index

export interface AccountsMap {
	[addr: string]: AccountStoreI;
}

/**
 * RuntimeAccountMap is for AccountStore used in runtime
 * (where we use maps instead of arrays in sdk structures). */
export type RuntimeAccountMap = Map<string, AccountAddress>;

export interface BaseTxReceipt {
	txn: EncTx;
	txID: string;
	gas?: number;
	logs?: Uint8Array[];
}

export type TxReceipt = BaseTxReceipt | AppInfo | ASAInfo;

export interface State {
	accounts: Map<string, AccountStoreI>;
	accountNameAddress: Map<string, AccountAddress>;
	globalApps: Map<number, string>;
	assetDefs: Map<number, AccountAddress>;
	assetNameInfo: Map<string, ASAInfo>;
	appNameMap: Map<string, AppInfo>;
	appCounter: number;
	assetCounter: number;
	txReceipts: Map<string, TxReceipt>; // map of {txID: txReceipt}
}

export interface DeployedAssetInfo {
	creator: AccountAddress;
	txID: string;
	confirmedRound: number;
	deleted: boolean;
}

// ASA deployment information (log)
export interface ASAInfo extends DeployedAssetInfo {
	assetIndex: number;
	assetDef: types.ASADef;
	logs?: Uint8Array[];
}

// Stateful smart contract deployment information (log)
export interface AppInfo extends DeployedAssetInfo {
	appID: number;
	applicationAccount: string;
	timestamp: number;
	approvalFile: string;
	clearFile: string;
	logs?: Uint8Array[];
	gas?: number; // used in runtime
}

export interface AppDeploymentFlags extends AppOptionalFlags {
	sender: AccountSDK;
	localInts: number;
	localBytes: number;
	globalInts: number;
	globalBytes: number;
	extraPages?: number;
}

// describes interpreter's local context (state + txns)
export interface Context {
	state: State;
	sharedScratchSpace: Map<number, StackElem[]>;
	knowableID: Map<number, ID>;
	tx: EncTx; // current txn
	gtxs: EncTx[]; // all transactions
	args?: Uint8Array[];
	debugStack?: number; //  max number of top elements from the stack to print after each opcode execution.
	lastLog: Uint8Array;
	budget: number;
	pooledApplCost: number; // total opcode cost for each application call for single/group tx
	// inner transaction props
	isInnerTx: boolean; // true if "ctx" is switched to an inner transaction
	// save appID use inner tx call stack
	innerTxAppIDCallStack: number[];
	remainingTxns: number; // number txn can execute on current call, include inner txn and normal txn.
	// remaining fee from pool
	remainingFee: number;
	getAccount: (address: string) => AccountStoreI;
	getAssetAccount: (assetId: number) => AccountStoreI;
	getApp: (appID: number, line?: number) => SSCAttributesM;
	getCallerApplicationID: () => number;
	getCallerApplicationAddress: () => AccountAddress;
	transferAlgo: (transaction: Transaction) => void;
	verifyMinimumFees: () => void;
	deductFee: (sender: AccountAddress, index: number, params: types.TxParams) => void;
	transferAsset: (transaction: Transaction) => void;
	modifyAsset: (assetId: number, fields: types.AssetModFields) => void;
	freezeAsset: (assetId: number, freezeTarget: string, freezeState: boolean) => void;
	revokeAsset: (
		recipient: string,
		assetID: number,
		revocationTarget: string,
		amount: bigint
	) => void;
	destroyAsset: (assetId: number) => void;
	deleteApp: (appID: number) => void;
	closeApp: (sender: AccountAddress, appID: number) => void;
	processTransactions: (
		signedTransactions: algosdk.SignedTransaction[],
		appDefMap?: Map<number, types.AppDefinition | types.SmartContract>,
		lsigMap?: Map<number, types.Lsig>
	) => TxReceipt[];
	deployASA: (
		name: string,
		fromAccountAddr: AccountAddress,
		flags: ASADeploymentFlags
	) => ASAInfo;
	deployASADef: (
		name: string,
		asaDef: types.ASADef,
		fromAccountAddr: AccountAddress,
		flags: ASADeploymentFlags
	) => ASAInfo;
	optInToASA: (assetIndex: number, address: AccountAddress, flags: types.TxParams) => TxReceipt;
	deployApp: (
		fromAccountAddr: string,
		appDefinition: types.AppDefinition,
		idx: number,
		scTmplParams?: SCParams
	) => AppInfo;
	optInToApp: (accountAddr: string, appID: number, idx: number) => TxReceipt;
	updateApp: (
		appID: number,
		appSourceCode: types.SmartContract,
		idx: number,
		scTmplParams?: SCParams
	) => TxReceipt;
}

// custom AssetHolding for AccountStore (using bigint in amount instead of number)
export interface AssetHoldingM {
	amount: bigint;
	"asset-id": number;
	creator: string;
	"is-frozen": boolean;
}

// custom AppsLocalState for AccountStore (using maps instead of array in 'key-value')
export interface AppLocalStateM {
	id: number;
	"key-value": Map<string, StackElem>; // string represents bytes as string eg. 11,22,34
	schema: modelsv2.ApplicationStateSchema;
}

// custom SSCAttributes for AccountStore (using maps instead of array in 'global-state')
export interface SSCAttributesM {
	"approval-program": string;
	"clear-state-program": string;
	creator: string;
	"global-state": Map<string, StackElem>;
	"global-state-schema": modelsv2.ApplicationStateSchema;
	"local-state-schema": modelsv2.ApplicationStateSchema;
}

// custom CreatedApp for AccountStore
export interface CreatedAppM {
	id: number;
	attributes: SSCAttributesM;
}

export interface RuntimeAccountI extends AccountSDK {
	name?: string;
	spend: types.AccountAddress;

	rekeyTo: (authAccountAddress: types.AccountAddress) => void;
	getSpendAddress: () => types.AccountAddress;
}

// represent account used in tests and by the context
// NOTE: custom notations are used rather than SDK AccountState notations
export interface AccountStoreI {
	address: string;
	assets: Map<number, AssetHoldingM>;
	amount: bigint;
	minBalance: number;
	appsLocalState: Map<number, AppLocalStateM>;
	appsTotalSchema: modelsv2.ApplicationStateSchema;
	createdApps: Map<number, SSCAttributesM>;
	createdAssets: Map<number, modelsv2.AssetParams>;
	account: RuntimeAccountI;

	balance: () => bigint;
	rekeyTo: (authAccountAddress: types.AccountAddress) => void;
	getSpendAddress: () => AccountAddress;
	getApp: (appID: number) => SSCAttributesM | undefined;
	getAppFromLocal: (appID: number) => AppLocalStateM | undefined;
	addApp: (appID: number, appDefinition: types.AppDefinitionFromSource) => CreatedAppM;
	getAssetDef: (assetId: number) => modelsv2.AssetParams | undefined;
	getAssetHolding: (assetId: number) => AssetHoldingM | undefined;
	addAsset: (assetId: number, name: string, asadef: types.ASADef) => modelsv2.AssetParams;
	modifyAsset: (assetId: number, fields: types.AssetModFields) => void;
	closeAsset: (assetId: number) => void;
	setFreezeState: (assetId: number, state: boolean) => void;
	destroyAsset: (assetId: number) => void;
	optInToApp: (appID: number, appParams: SSCAttributesM) => void;
	optInToASA: (assetIndex: number, assetHolding: AssetHoldingM) => void;
	deleteApp: (appID: number) => void;
	closeApp: (appID: number) => void;
	getLocalState: (appID: number, key: Uint8Array | string) => StackElem | undefined;
	setLocalState: (
		appID: number,
		key: Uint8Array | string,
		value: StackElem,
		line?: number
	) => AppLocalStateM;
	getGlobalState: (appID: number, key: Uint8Array | string) => StackElem | undefined;
	setGlobalState: (
		appID: number,
		key: Uint8Array | string,
		value: StackElem,
		line?: number
	) => void;
}

/**
 * https://developer.algorand.org/docs/reference/teal/specification/#oncomplete */
export enum TxOnComplete {
	NoOp = "0",
	OptIn = "1",
	CloseOut = "2",
	ClearState = "3",
	UpdateApplication = "4",
	DeleteApplication = "5",
}

/**
 * https://developer.algorand.org/docs/reference/teal/specification/#execution-modes */
export enum ExecutionMode {
	SIGNATURE, // stateless TEAL
	APPLICATION, // application call (NoOp, CloseOut..)
}

/**
 * Stateful Smart contract flags for specifying sender and schema */
export interface types extends AppOptionalFlags {
	sender: AccountSDK;
	localInts: number;
	localBytes: number;
	globalInts: number;
	globalBytes: number;
	extraPages?: number;
}

/**
 * Stateful smart contract transaction optional parameters (accounts, args..). */
export interface AppOptionalFlags {
	/**
	 * Transaction specific arguments accessed from
	 * the application's approval-program and clear-state-program.
	 */
	appArgs?: Array<Uint8Array | string>;
	/**
	 * List of accounts in addition to the sender that may
	 * be accessed from the application's approval-program and clear-state-program.
	 */
	accounts?: string[];
	/**
	 * Lists the applications in addition to the application-id
	 * whose global states may be accessed by this
	 * application's approval-program and clear-state-program. The access is read-only.
	 */
	foreignApps?: number[];
	/**
	 * Lists the assets whose AssetParams may be accessed by
	 * this application's approval-program and clear-state-program.
	 * The access is read-only.
	 */
	foreignAssets?: number[];
	// Any data up to 1000 bytes.
	note?: Uint8Array;
	// A lease enforces mutual exclusion of transactions.
	lease?: Uint8Array;
	// you can learn more about these parameters from here.(https://developer.algorand.org/docs/reference/transactions/#application-call-transaction)
}

/**
 * Stateful Smart contract flags for specifying sender and schema */
export interface AppDeploymentFlags extends AppOptionalFlags {
	sender: AccountSDK;
	localInts: number;
	localBytes: number;
	globalInts: number;
	globalBytes: number;
	extraPages?: number;
}

export interface AnyMap {
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface Account extends AccountSDK {
	// from AccountSDK: addr: string;
	//                  sk: Uint8Array
	name: string;
}

export interface ASADeploymentFlags extends types.TxParams {
	creator: Account;
}

/**
 * SDK account type, used in algob */
export type AccountMap = Map<string, Account>;

/**
 * SDK decoding types (Configure how the integer will be decoded)
 * https://github.com/algorand/js-algorand-sdk/blob/develop/src/encoding/uint64.ts#L29
 */
export enum DecodingMode {
	SAFE = "safe",
	MIXED = "mixed",
	BIGINT = "bigint",
}

// used for pyTEALOps
export interface SCParams {
	[key: string]: string | bigint;
}

export interface ReplaceParams {
	[key: string]: string;
}

export enum Base64Encoding {
	URL = 0,
	STD = 1,
}
