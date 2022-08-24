import { EncodedAssetParams, EncodedLocalStateSchema, EncodedTransaction } from "algosdk";
import cloneDeep from "lodash.clonedeep";

export const MIN_UINT64 = 0n;
export const MAX_UINT64 = 0xffffffffffffffffn;
export const MAX_UINT128 = 340282366920938463463374607431768211455n;
export const MAX_UINT8 = 255;
export const MIN_UINT8 = 0;
export const MAX_UINT6 = 63n;
export const DEFAULT_STACK_ELEM = 0n;
export const MAX_CONCAT_SIZE = 4096;
export const ALGORAND_MIN_TX_FEE = 1000;
// https://github.com/algorand/go-algorand/blob/master/config/consensus.go#L659
export const ALGORAND_ACCOUNT_MIN_BALANCE = 0.1e6; // 0.1 ALGO
export const MaxTEALVersion = 7;
export const MinVersionSupportC2CCall = 6;

// values taken from: https://developer.algorand.org/docs/features/asc1/stateful/#minimum-balance-requirement-for-a-smart-contract
// minimum balance costs (in microalgos) for app schema
export const APPLICATION_BASE_FEE = 0.1e6; // base fee for creating or opt-in to application
export const ASSET_CREATION_FEE = 0.1e6; // creation fee for asset
export const SSC_VALUE_UINT = 28500; // cost for value as uint64
export const SSC_VALUE_BYTES = 50000; // cost for value as bytes
export const MAX_KEY_BYTES = 64; // max length of key
export const MAX_KEY_VAL_BYTES = 128; // max combined length of key-value pair

// values taken from [https://github.com/algorand/go-algorand/blob/master/config/consensus.go#L691]
export const LOGIC_SIG_MAX_COST = 20000;
export const MAX_APP_PROGRAM_COST = 700;
export const LogicSigMaxSize = 1000;
export const MaxAppProgramLen = 1024;
export const MaxTxnNoteBytes = 1024;
export const ALGORAND_MAX_APP_ARGS_LEN = 16;
export const ALGORAND_MAX_TX_ACCOUNTS_LEN = 4;
// the assets and application arrays combined and totaled with the accounts array can not exceed 8
export const ALGORAND_MAX_TX_ARRAY_LEN = 8;
export const MAX_INNER_TRANSACTIONS = 16;
export const ALGORAND_MAX_LOGS_COUNT = 32;
export const ALGORAND_MAX_LOGS_LENGTH = 1024;

export const MAX_ALGORAND_ACCOUNT_ASSETS = 1000;
export const MAX_ALGORAND_ACCOUNT_CREATED_APPS = 10;

export const MAX_ALGORAND_ACCOUNT_OPTEDIN_APPS = 50;

//smart contract constraints
// https://developer.algorand.org/docs/get-details/parameter_tables/
export const MAX_GLOBAL_SCHEMA_ENTRIES = 64;
export const MAX_LOCAL_SCHEMA_ENTRIES = 16;

// for byteslice arithmetic ops, inputs are limited to 64 bytes,
// but ouput can be upto 128 bytes (eg. when using b+ OR b*)
// https://github.com/algorand/go-algorand/blob/bd5a00092c8a63dba8314b97851e46ff247cf7c1/data/transactions/logic/eval.go#L1302
export const MAX_INPUT_BYTE_LEN = 64;
export const MAX_OUTPUT_BYTE_LEN = 128;

export const ZERO_ADDRESS = new Uint8Array(32);
export const ZERO_ADDRESS_STR = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
const zeroUint64 = 0n;
const zeroByte = new Uint8Array(0);

// keys with value as null does not represent a txn/global field, these are handled explicitly
// in txn.ts using switch
type keyOfEncTx =
	| keyof EncodedTransaction
	| keyof EncodedAssetParams
	| keyof EncodedLocalStateSchema;

// https://developer.algorand.org/docs/reference/teal/opcodes/#txn
// transaction fields supported by teal v1
export const TxnFields: { [key: number]: { [key: string]: keyOfEncTx | null } } = {
	1: {
		Sender: "snd",
		Fee: "fee",
		FirstValid: "fv",
		FirstValidTime: null,
		LastValid: "lv",
		Note: "note",
		Lease: "lx",
		Receiver: "rcv",
		Amount: "amt",
		CloseRemainderTo: "close",
		VotePK: "votekey",
		SelectionPK: "selkey",
		VoteFirst: "votefst",
		VoteLast: "votelst",
		VoteKeyDilution: "votekd",
		Type: "type",
		TypeEnum: null,
		XferAsset: "xaid",
		AssetAmount: "aamt",
		AssetSender: "asnd",
		AssetReceiver: "arcv",
		AssetCloseTo: "aclose",
		GroupIndex: null,
		TxID: null,
	},
};

// transaction fields supported by teal v2
TxnFields[2] = {
	...TxnFields[1],
	ApplicationID: "apid",
	OnCompletion: "apan",
	ApplicationArgs: "apaa",
	NumAppArgs: null,
	Accounts: "apat",
	NumAccounts: null,
	ApprovalProgram: "apap",
	ClearStateProgram: "apsu",
	RekeyTo: "rekey",
	ConfigAsset: "caid",
	ConfigAssetTotal: "t",
	ConfigAssetDecimals: "dc",
	ConfigAssetDefaultFrozen: "df",
	ConfigAssetUnitName: "un",
	ConfigAssetName: "an",
	ConfigAssetURL: "au",
	ConfigAssetMetadataHash: "am",
	ConfigAssetManager: "m",
	ConfigAssetReserve: "r",
	ConfigAssetFreeze: "f",
	ConfigAssetClawback: "c",
	FreezeAsset: "faid",
	FreezeAssetAccount: "fadd",
	FreezeAssetFrozen: "afrz",
};

TxnFields[3] = {
	...TxnFields[2],
	Assets: "apas",
	NumAssets: null,
	Applications: "apfa",
	NumApplications: null,
	GlobalNumUint: "nui",
	GlobalNumByteSlice: "nbs",
	LocalNumUint: "nui",
	LocalNumByteSlice: "nbs",
};

TxnFields[4] = {
	...TxnFields[3],
	ExtraProgramPages: "apep",
};

TxnFields[5] = {
	...TxnFields[4],
	CreatedAssetID: null,
	CreatedApplicationID: null,
	Nonparticipation: "nonpart",
};

TxnFields[6] = {
	...TxnFields[5],
	LastLog: null,
	StateProofPK: null,
};

TxnFields[7] = {
	...TxnFields[6],
};

export const ITxnFields: { [key: number]: { [key: string]: keyOfEncTx | null } } = {
	1: {},
	2: {},
	3: {},
	4: {},
	5: {
		Logs: null,
		NumLogs: null,
		CreatedAssetID: null,
		CreatedApplicationID: null,
	},
};

ITxnFields[6] = {
	...ITxnFields[5],
};

ITxnFields[7] = {
	...ITxnFields[6],
};

// transaction fields of type array
export const TxArrFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(["Accounts", "ApplicationArgs"]),
};
TxArrFields[3] = new Set([...TxArrFields[2], "Assets", "Applications"]);
TxArrFields[4] = cloneDeep(TxArrFields[3]);
TxArrFields[5] = new Set([...TxArrFields[4], "Logs"]);
TxArrFields[6] = cloneDeep(TxArrFields[5]);
TxArrFields[7] = cloneDeep(TxArrFields[6]);

// itxn fields of type array
export const ITxArrFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set(["Logs"]),
};

ITxArrFields[6] = cloneDeep(ITxArrFields[5]);
ITxArrFields[7] = cloneDeep(ITxArrFields[6]);

export const TxFieldDefaults: { [key: string]: any } = {
	Sender: ZERO_ADDRESS,
	Fee: zeroUint64,
	FirstValid: zeroUint64,
	LastValid: zeroUint64,
	Note: zeroByte,
	Lease: zeroByte,
	Receiver: ZERO_ADDRESS,
	Amount: zeroUint64,
	CloseRemainderTo: ZERO_ADDRESS,
	VotePK: ZERO_ADDRESS,
	SelectionPK: ZERO_ADDRESS,
	VoteFirst: zeroUint64,
	VoteLast: zeroUint64,
	VoteKeyDilution: zeroUint64,
	Type: zeroByte,
	TypeEnum: zeroUint64,
	XferAsset: zeroUint64,
	AssetAmount: zeroUint64,
	AssetSender: ZERO_ADDRESS,
	AssetReceiver: ZERO_ADDRESS,
	AssetCloseTo: ZERO_ADDRESS,
	GroupIndex: zeroUint64,
	ApplicationID: zeroUint64,
	OnCompletion: zeroUint64,
	ApplicationArgs: zeroByte,
	NumAppArgs: zeroUint64,
	Accounts: zeroByte,
	NumAccounts: zeroUint64,
	ApprovalProgram: zeroByte,
	ClearStateProgram: zeroByte,
	RekeyTo: ZERO_ADDRESS,
	ConfigAsset: zeroUint64,
	ConfigAssetTotal: zeroUint64,
	ConfigAssetDecimals: zeroUint64,
	ConfigAssetDefaultFrozen: zeroUint64,
	ConfigAssetUnitName: zeroByte,
	ConfigAssetName: zeroByte,
	ConfigAssetURL: zeroByte,
	ConfigAssetMetadataHash: zeroByte,
	ConfigAssetManager: ZERO_ADDRESS,
	ConfigAssetReserve: ZERO_ADDRESS,
	ConfigAssetFreeze: ZERO_ADDRESS,
	ConfigAssetClawback: ZERO_ADDRESS,
	FreezeAsset: zeroUint64,
	FreezeAssetAccount: ZERO_ADDRESS,
	FreezeAssetFrozen: zeroUint64,
	Assets: zeroByte,
	NumAssets: zeroUint64,
	Applications: zeroByte,
	NumApplications: zeroUint64,
	GlobalNumUint: zeroUint64,
	GlobalNumByteSlice: zeroUint64,
	LocalNumUint: zeroUint64,
	LocalNumByteSlice: zeroUint64,
	ExtraProgramPages: zeroUint64,
	Nonparticipation: zeroUint64,
};

export const AssetParamMap: { [key: number]: { [key: string]: string } } = {
	1: {
		AssetTotal: "total", // Total number of units of this asset
		AssetDecimals: "decimals", // See AssetDef.Decimals
		AssetDefaultFrozen: "defaultFrozen", // Frozen by default or not
		AssetUnitName: "unitName", // Asset unit name
		AssetName: "name", // Asset name
		AssetURL: "url", // URL with additional info about the asset
		AssetMetadataHash: "metadataHash", // Arbitrary commitment
		AssetManager: "manager", // Manager commitment
		AssetReserve: "reserve", // Reserve address
		AssetFreeze: "freeze", // Freeze address
		AssetClawback: "clawback", // Clawback address
	},
};

AssetParamMap[2] = { ...AssetParamMap[1] };
AssetParamMap[3] = { ...AssetParamMap[2] };
AssetParamMap[4] = { ...AssetParamMap[3] };

AssetParamMap[5] = {
	...AssetParamMap[4],
	AssetCreator: "creator",
};

AssetParamMap[6] = { ...AssetParamMap[5] };
AssetParamMap[7] = { ...AssetParamMap[6] };

// app param use for app_params_get opcode
export const AppParamDefined: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set([
		"AppApprovalProgram",
		"AppClearStateProgram",
		"AppGlobalNumUint",
		"AppGlobalNumByteSlice",
		"AppLocalNumUint",
		"AppLocalNumByteSlice",
		"AppExtraProgramPages",
		"AppCreator",
		"AppAddress",
	]),
};

AppParamDefined[6] = cloneDeep(AppParamDefined[5]);
AppParamDefined[7] = cloneDeep(AppParamDefined[6]);

// param use for query acct_params_get opcode

export const AcctParamQueryFields: { [key: string]: { version: number } } = {
	AcctBalance: { version: 6 },
	AcctMinBalance: { version: 6 },
	AcctAuthAddr: { version: 6 },
};
export const reDigit = /^\d+$/;
export const reDec = /^(0|[1-9]\d*)$/;
export const reHex = /^0x[0-9a-fA-F]+$/;
export const reOct = /^0[0-8]+$/;

/** is Base64 regex
 * ^                          # Start of input
 * ([0-9a-zA-Z+/]{4})*        # Groups of 4 valid characters decode
 *                            # to 24 bits of data for each group
 * (                          # Either ending with:
 *     ([0-9a-zA-Z+/]{2}==)   # two valid characters followed by ==
 *     |                      # , or
 *     ([0-9a-zA-Z+/]{3}=)    # three valid characters followed by =
 * )?                         # , or nothing
 * $                          # End of input
 */
export const reBase64 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

/** is Base64Url regex
 * ^                          # Start of input
 * ([0-9a-zA-Z_-]{4})*        # Groups of 4 valid characters decode
 *                            # to 24 bits of data for each group
 * (                          # Either ending with:
 *     ([0-9a-zA-Z_-]{2}==)   # two valid characters followed by ==
 *     |                      # , or
 *     ([0-9a-zA-Z_-]{3}=)    # three valid characters followed by =
 * )?                         # , or nothing
 * $                          # End of input
 */
export const reBase64Url = /^([0-9a-zA-Z_-]{4})*(([0-9a-zA-Z_-]{2}==)|([0-9a-zA-Z_-]{3}=))?$/;

// A-Z and 2-7 repeated, with optional `=` at the end
export const reBase32 = /^[A-Z2-7]+=*$/;

// reference for values: https://github.com/algorand/go-algorand/blob/master/config/consensus.go#L510
// for fields: https://developer.algorand.org/docs/reference/teal/opcodes/#global
// global field supported by teal v1
export const GlobalFields: { [key: number]: { [key: string]: any } } = {
	// teal version => global field => value
	1: {
		MinTxnFee: ALGORAND_MIN_TX_FEE,
		MinBalance: 10000,
		MaxTxnLife: 1000,
		ZeroAddress: ZERO_ADDRESS,
		GroupSize: null,
	},
};

// global field supported by teal v2
// Note: Round, LatestTimestamp are dummy values and these are overrided by runtime class's
// round and timestamp
GlobalFields[2] = {
	...GlobalFields[1],
	LogicSigVersion: MaxTEALVersion,
	Round: 1,
	LatestTimestamp: 1,
	CurrentApplicationID: null,
};

// global fields supported by tealv3
GlobalFields[3] = {
	...GlobalFields[2],
	CreatorAddress: null,
};

// global fields supported by tealv4
GlobalFields[4] = {
	...GlobalFields[3],
};

// global fields supported by tealv5
GlobalFields[5] = {
	...GlobalFields[4],
	GroupID: null,
	CurrentApplicationAddress: null,
};

// global fields supported in tealv6
GlobalFields[6] = {
	...GlobalFields[5],
	OpcodeBudget: 0,
	CallerApplicationID: null,
	CallerApplicationAddress: null,
};

GlobalFields[7] = {
	...GlobalFields[6],
};

// creating map for opcodes whose cost is other than 1
export const OpGasCost: { [key: number]: { [key: string]: number } } = {
	// version => opcode => cost
	// v1 opcodes cost
	1: {
		sha256: 7,
		sha512_256: 9,
		keccak256: 26,
		ed25519verify: 1900,
	},
};

// v2 opcodes cost
OpGasCost[2] = {
	...OpGasCost[1], // includes all v1 opcodes
	sha256: 35,
	sha512_256: 45,
	keccak256: 130,
};

/**
 * In tealv3, cost of crypto opcodes are same as v2.
 * All other opcodes have cost 1
 */
OpGasCost[3] = { ...OpGasCost[2] };

/*
 * tealv4
 */
OpGasCost[4] = {
	...OpGasCost[3],
	"b+": 10,
	"b-": 10,
	"b*": 20,
	"b/": 20,
	"b%": 20,
	"b|": 6,
	"b&": 6,
	"b^": 6,
	"b~": 4,
};

/**
 * teal v5
 */
OpGasCost[5] = {
	...OpGasCost[4],
	ecdsa_verify: 1700,
	ecdsa_pk_decompress: 650,
	ecdsa_pk_recover: 2000,
};

OpGasCost[6] = {
	...OpGasCost[5],
	bsqrt: 40,
};
OpGasCost[7] = {
	...OpGasCost[6],
	sha3_256: 130,
};

export const enum MathOp {
	// arithmetic
	Add,
	Sub,
	Mul,
	Div,
	Mod,
	// relational
	LessThan,
	GreaterThan,
	LessThanEqualTo,
	GreaterThanEqualTo,
	// logical & bitwise
	EqualTo,
	NotEqualTo,
	BitwiseOr,
	BitwiseAnd,
	BitwiseXor,
	BitwiseInvert,
}

/**
 * https://developer.algorand.org/docs/get-details/dapps/avm/teal/specification/#typeenum-constants
 */
export enum TransactionTypeEnum {
	UNKNOWN = "unknown",
	PAYMENT = "pay",
	KEY_REGISTRATION = "keyreg",
	ASSET_CONFIG = "acfg",
	ASSET_TRANSFER = "axfer",
	ASSET_FREEZE = "afrz",
	APPLICATION_CALL = "appl",
}
