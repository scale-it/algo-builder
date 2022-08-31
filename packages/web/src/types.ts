/* eslint-disable no-unused-vars */

import { IClientMeta } from "@walletconnect/types";
import { Account as AccountSDK, LogicSigAccount, Transaction } from "algosdk";
import * as z from "zod";

import { WalletMultisigMetadata, WalletTransaction } from "./algo-signer-types";
import { WAIT_ROUNDS } from "./lib/constants";
import type { ASADefSchema, ASADefsSchema } from "./types-input";

export type AccountAddress = string;

export interface AnyMap {
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * After an asset has been created only the manager,
 * reserve, freeze and reserve accounts can be changed.
 * All other parameters are locked for the life of the asset.
 */
export interface AssetModFields {
	manager?: string;
	reserve?: string;
	freeze?: string;
	clawback?: string;
}

/**
 * Common transaction parameters (fees, note..) */
export interface TxParams {
	/**
	 * feePerByte or totalFee is used to set the appropriate transaction fee parameter.
	 * If both are set then totalFee takes precedence.
	 * NOTE: SDK expects`fee: number` and boolean `flatFee`. But the API expects only one
	 * on parameter: `fee`. Here, we define feePerByte and totalFee - both as numberic
	 * parameters. We think that this is more explicit. */
	feePerByte?: number;
	totalFee?: number;
	flatFee?: boolean;
	// The first round for when the transaction is valid.
	firstValid?: number;
	// firstValid + validRounds will give us the ending round for which the transaction is valid.
	validRounds?: number;
	// A lease enforces mutual exclusion of transactions.
	lease?: Uint8Array;
	// Any data up to 1000 bytes.
	note?: string | Uint8Array;
	// base64 encoded string
	noteb64?: string;
	// When set, it indicates that the transaction is requesting
	// that the Sender account should be closed, and all remaining
	// funds, after the fee and amount are paid, be transferred to this address.
	closeRemainderTo?: AccountAddress;
	// Specifies the authorized address.
	rekeyTo?: AccountAddress;
	// you can learn more about these parameters here.(https://developer.algorand.org/docs/reference/transactions/#common-fields-header-and-type)
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
 * Transaction execution parameters (on blockchain OR runtime) */
export type ExecParams =
	| AlgoTransferParam
	| AssetTransferParam
	| KeyRegistrationParam
	| AppCallsParam
	| ModifyAssetParam
	| FreezeAssetParam
	| RevokeAssetParam
	| DestroyAssetParam
	| DeployASAParam
	| DeployAppParam
	| OptInASAParam
	| UpdateAppParam;

export enum SignType {
	SecretKey,
	LogicSignature,
}

export enum TransactionType {
	TransferAlgo,
	TransferAsset,
	KeyRegistration,
	ModifyAsset,
	FreezeAsset,
	RevokeAsset,
	DestroyAsset,
	CallApp,
	ClearApp,
	CloseApp,
	DeleteApp,
	DeployASA,
	DeployApp,
	OptInASA,
	OptInToApp,
	UpdateApp,
}

interface SignWithSk {
	sign: SignType.SecretKey;
	fromAccount: AccountSDK;
	/**
	 * if passed then it will be used as the from account address, but tx will be signed
	 * by fromAcount's sk. This is used if an account address is rekeyed to another account. */
	fromAccountAddr?: AccountAddress;
}

interface SignWithLsig {
	sign: SignType.LogicSignature;
	fromAccount?: AccountSDK;
	fromAccountAddr: AccountAddress;
	lsig: LogicSigAccount;
	/** logic signature args */
	args?: Uint8Array[];
}

export type Lsig = SignWithLsig;

export type Sign = SignWithSk | SignWithLsig;

export type BasicParams = Sign & {
	payFlags: TxParams;
};

export type DeployASAParam = BasicParams & {
	type: TransactionType.DeployASA;
	asaName: string;
	asaDef?: ASADef;
	overrideAsaDef?: Partial<ASADef>;
};

export enum MetaType {
	FILE,
	SOURCE_CODE,
	BYTES,
}
export type StorageConfig = {
	localInts: number;
	localBytes: number;
	globalInts: number;
	globalBytes: number;
	extraPages?: number;
	appName: string; // name of app to store info against in checkpoint, now it's required
};

export type SourceFile = {
	metaType: MetaType.FILE;
	approvalProgramFilename: string;
	clearProgramFilename: string;
};

export type SourceCode = {
	metaType: MetaType.SOURCE_CODE;
	approvalProgramCode: string;
	clearProgramCode: string;
};

// Compiled bytes of a TEAL program.
export type SourceCompiled = {
	metaType: MetaType.BYTES;
	approvalProgramBytes: Uint8Array;
	clearProgramBytes: Uint8Array;
};

export type SmartContract = SourceFile | SourceCode | SourceCompiled;

export type AppDefinitionFromFile = StorageConfig & AppOptionalFlags & SourceFile;

export type AppDefinitionFromSource = StorageConfig & AppOptionalFlags & SourceCode;

export type AppDefinitionFromSourceCompiled = StorageConfig & AppOptionalFlags & SourceCompiled;

export type AppDefinition =
	| AppDefinitionFromFile
	| AppDefinitionFromSource
	| AppDefinitionFromSourceCompiled;

export type DeployAppParam = BasicParams & {
	type: TransactionType.DeployApp;
	appDefinition: AppDefinition;
};

export type UpdateAppParam = BasicParams &
	AppOptionalFlags & {
		type: TransactionType.UpdateApp;
		appID: number;
		newAppCode: SmartContract;
		appName: string; // name of app to store info against in checkpoint
	};

export type AppCallsParam = BasicParams &
	AppOptionalFlags & {
		type:
			| TransactionType.CallApp
			| TransactionType.ClearApp
			| TransactionType.CloseApp
			| TransactionType.DeleteApp
			| TransactionType.OptInToApp;
		appID: number;
	};

export type OptInASAParam = BasicParams & {
	type: TransactionType.OptInASA;
	assetID: number | string;
};

export type ModifyAssetParam = BasicParams & {
	type: TransactionType.ModifyAsset;
	assetID: number | string;
	fields: AssetModFields;
};

export type FreezeAssetParam = BasicParams & {
	type: TransactionType.FreezeAsset;
	assetID: number | string;
	freezeTarget: AccountAddress;
	freezeState: boolean;
};

export type RevokeAssetParam = BasicParams & {
	type: TransactionType.RevokeAsset;
	/**
	 * Revoked assets are sent to this address
	 */
	recipient: AccountAddress;
	assetID: number | string;
	/** Revocation target is the account from which the clawback revokes asset. */
	revocationTarget: AccountAddress;
	amount: number | bigint;
};

export type DestroyAssetParam = BasicParams & {
	type: TransactionType.DestroyAsset;
	assetID: number | string;
};

export type AlgoTransferParam = BasicParams & {
	type: TransactionType.TransferAlgo;
	toAccountAddr: AccountAddress;
	amountMicroAlgos: number | bigint;
};

export type AssetTransferParam = BasicParams & {
	type: TransactionType.TransferAsset;
	toAccountAddr: AccountAddress;
	amount: number | bigint;
	assetID: number | string;
};

export type KeyRegistrationParam = BasicParams & {
	type: TransactionType.KeyRegistration;
	/// voteKey must be a 32 byte Uint8Array or Buffer or base64 string.
	voteKey: string | Uint8Array;
	/// voteKey must be a 32 byte Uint8Array or Buffer or base64 string.
	selectionKey: string | Uint8Array;
	voteFirst: number;
	voteLast: number;
	voteKeyDilution: number;
	nonParticipation?: false;
};

export interface TransactionAndSign {
	transaction: Transaction;
	sign: Sign;
}

export type ASADef = z.infer<typeof ASADefSchema>;

export type ASADefs = z.infer<typeof ASADefsSchema>;

export interface RequestError extends Error {
	response?: {
		statusCode: number;
		text: string;
		body: {
			message: string;
		};
		error?: Error;
	};
	error?: Error;
}

export interface FileError extends Error {
	errno: number;
}

// This function is used to check if given objects implements `FileError` interface
export function isFileError(object: unknown): object is FileError {
	return Object.prototype.hasOwnProperty.call(object, "errno");
}

// This function is used to check if given objects implements `RequestError` interface
// https://www.technicalfeeder.com/2021/02/how-to-check-if-a-object-implements-an-interface-in-typescript/
export function isRequestError(object: unknown): object is RequestError {
	const res =
		Object.prototype.hasOwnProperty.call(object, "response.statusCode") &&
		Object.prototype.hasOwnProperty.call(object, "response.text") &&
		Object.prototype.hasOwnProperty.call(object, "response.body.message") &&
		Object.prototype.hasOwnProperty.call(object, "response.error");
	return res && Object.prototype.hasOwnProperty.call(object, "error");
}

// This function checks if given object implements `Transaction` class
export function isSDKTransaction(object: unknown): object is Transaction {
	if (object === undefined || object === null) {
		return false;
	}
	const props = ["tag", "from", "fee", "firstRound", "lastRound", "genesisID", "genesisHash"];
	let res = Object.prototype.hasOwnProperty.call(object, "name");
	for (const prop of props) {
		res = res && Object.prototype.hasOwnProperty.call(object, prop);
	}
	return res;
}

// This function checks if given object implements `Transaction` class and has Sign
export function isSDKTransactionAndSign(object: unknown): object is TransactionAndSign {
	if (object === undefined || object === null) {
		return false;
	}
	const res = isSDKTransaction((object as TransactionAndSign).transaction);
	return Object.prototype.hasOwnProperty.call(object, "sign") && res;
}
// This function checks if given object implements `ExecParams` class
export function isExecParams(object: unknown): object is ExecParams {
	if (object === undefined || object === null) {
		return false;
	}
	const props = ["payFlags", "sign"];
	let res = Object.prototype.hasOwnProperty.call(object, "type");
	for (const prop of props) {
		res = res && Object.prototype.hasOwnProperty.call(object, prop);
	}
	return res;
}

/* Wallet Connect types */

export enum ChainType {
	MainNet = "MainNet",
	TestNet = "TestNet",
	BetaNet = "BetaNet",
}

export interface SessionConnectResponse {
	peerId: string;
	peerMeta?: IClientMeta;
	accounts: string[];
}

export interface SessionUpdateResponse {
	accounts: string[];
}

export interface SessionDisconnectResponse {
	message?: string;
}

export interface SignTxnOpts {
	/**
	 * Optional message explaining the reason of the group of
	 * transactions.
	 */
	message?: string;

	// other options may be present, but are not standard
}

export type SignTxnParams = [WalletTransaction[], SignTxnOpts?];

export interface TransactionInGroup {
	txn: Transaction;
	shouldSign?: boolean;
	signers?: string | string[];
	msig?: WalletMultisigMetadata;
	message?: string;
}

export interface AlgodTokenHeader {
	"X-Algo-API-Token": string;
}

export interface CustomTokenHeader {
	[headerName: string]: string;
}

export interface HttpNetworkConfig {
	server: string; // with optional http o https prefix
	port: string | number;
	token: string | AlgodTokenHeader | CustomTokenHeader;
	httpHeaders?: { [name: string]: string };
}

export { WAIT_ROUNDS };
