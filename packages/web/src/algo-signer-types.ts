// https://github.com/PureStake/algosigner/blob/develop/packages/common/src/types.ts
/* eslint-disable no-unused-vars */
export enum RequestErrors {
	None,
	NotAuthorized = "[RequestErrors.NotAuthorized] The extension user does not authorize the request.",
	InvalidTransactionParams = "[RequestErrors.InvalidTransactionParams] Invalid transaction parameters.",
	UnsupportedAlgod = "[RequestErrors.UnsupportedAlgod] The provided method is not supported.",
	UnsupportedLedger = "[RequestErrors.UnsupportedLedger] The provided ledger is not supported.",
	Undefined = "[RequestErrors.Undefined] An undefined error occurred.",
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Field<T> = string | number;

export type TAccount = Field<string>;
export type Note = Field<string>;
export type Amount = Field<number>;

export interface Transaction {
	readonly amount: Amount;
	readonly from: TAccount;
	readonly note?: Note;
	readonly to: TAccount;
}

export interface MultisigTransaction {
	readonly msig: any;
	readonly txn: Transaction;
}

export interface WalletMultisigMetadata {
	/// Multisig version.
	version: number;

	/**
	 * Multisig threshold value. Authorization requires a subset of
	 * signatures, equal to or greater than the threshold value.
	 */
	threshold: number;

	/**
	 * List of Algorand addresses of possible signers for this
	 * multisig. Order is important.
	 */
	addrs: string[];
}

export interface WalletTransaction {
	/**
	 * Base64 encoding of the canonical msgpack encoding of a
	 * Transaction. */
	txn: string;

	/**
	 * Optional authorized address used to sign the transaction when
	 * the account is rekeyed. Also called the signor/sgnr.
	 */
	authAddr?: string;

	/**
	 * Optional multisig metadata used to sign the transaction
	 */
	msig?: WalletMultisigMetadata;

	/**
	 * Optional list of addresses that must sign the transactions
	 */
	signers?: string[];

	/**
	 * Optional message explaining the reason of the transaction
	 */
	message?: string;
}

export const JSONRPC_VERSION = "2.0";

/* eslint-disable no-unused-vars */
export enum JsonRpcMethod {
	Heartbeat = "heartbeat",
	Authorization = "authorization",
	AuthorizationAllow = "authorization-allow",
	AuthorizationDeny = "authorization-deny",
	SignAllow = "sign-allow",
	SignAllowMultisig = "sign-allow-multisig",
	SignAllowWalletTx = "sign-allow-wallet-tx",
	SignDeny = "sign-deny",
	SignTransaction = "sign-transaction",
	SignMultisigTransaction = "sign-multisig-transaction",
	SignWalletTransaction = "sign-wallet-transaction",
	SendTransaction = "send-transaction",
	Algod = "algod",
	Indexer = "indexer",
	Accounts = "accounts",
	// UI methods
	CreateWallet = "create-wallet",
	DeleteWallet = "delete-wallet",
	CreateAccount = "create-account",
	SaveAccount = "save-account",
	ImportAccount = "import-account",
	DeleteAccount = "delete-account",
	GetSession = "get-session",
	Login = "login",
	Logout = "logout",
	AccountDetails = "account-details",
	Transactions = "transactions",
	AssetDetails = "asset-details",
	AssetsAPIList = "assets-api-list",
	AssetsVerifiedList = "assets-verified-list",
	SignSendTransaction = "sign-send-transaction",
	ChangeLedger = "change-ledger",
	SaveNetwork = "save-network",
	DeleteNetwork = "delete-network",
	GetLedgers = "get-ledgers",
}

export interface JsonPayload {
	[key: string]: string | number | Array<WalletTransaction> | JsonPayload | undefined;
}

export interface JsonRpcBody {
	readonly jsonrpc: string;
	readonly method: JsonRpcMethod;
	readonly params: JsonPayload;
	readonly id: string;
}

export enum MessageSource {
	Extension = "extension",
	DApp = "dapp",
	Router = "router",
	UI = "ui",
}
export interface MessageBody {
	readonly source: MessageSource;
	readonly body: JsonRpcBody;
}

export type JsonRpcResponse = string;

export interface Encoding {
	msgpackToBase64: (txn: Uint8Array) => string;

	base64ToMsgpack: (txn: string) => Uint8Array;
}

export interface AlgoSigner {
	encoding: Encoding;

	accounts: (params: JsonPayload, error?: RequestErrors) => Promise<JsonPayload>;

	sign: (params: Transaction, error?: RequestErrors) => Promise<JsonPayload>;

	signMultisig: (params: MultisigTransaction, error?: RequestErrors) => Promise<JsonPayload>;

	send: (params: any, error?: RequestErrors) => Promise<JsonPayload>;

	algod: (params: JsonPayload, error?: RequestErrors) => Promise<JsonPayload>;

	indexer: (params: JsonPayload, error?: RequestErrors) => Promise<JsonPayload>;

	signTxn: (transactions: WalletTransaction[], error?: RequestErrors) => Promise<JsonPayload>;
}
