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
export const maxStringSize = 4096;
// https://github.com/algorand/go-algorand/blob/master/config/consensus.go#L659
export const ALGORAND_ACCOUNT_MIN_BALANCE = 0.1e6; // 0.1 ALGO
export const MaxTEALVersion = 8;
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
export const MaxAppProgramLen = 2048;
export const MaxExtraAppProgramPages = 3;
export const MaxTxnNoteBytes = 1024;
export const ALGORAND_MAX_APP_ARGS_LEN = 16;
export const ALGORAND_MAX_TX_ACCOUNTS_LEN = 4;
// the assets and application arrays combined and totaled with the accounts array can not exceed 8
export const ALGORAND_MAX_TX_ARRAY_LEN = 8;
export const MAX_INNER_TRANSACTIONS = 16;
export const ALGORAND_MAX_LOGS_COUNT = 32;
export const ALGORAND_MAX_LOGS_LENGTH = 1024;

export const publicKeyLength = 32;
export const proofLength = 80;
export const seedLength = 32;

//smart contract constraints
// https://developer.algorand.org/docs/get-details/parameter_tables/
export const MAX_GLOBAL_SCHEMA_ENTRIES = 64;
export const MAX_LOCAL_SCHEMA_ENTRIES = 16;

// for byteslice arithmetic ops, inputs are limited to 64 bytes,
// but ouput can be upto 128 bytes (eg. when using b+ OR b*)
// https://github.com/algorand/go-algorand/blob/bd5a00092c8a63dba8314b97851e46ff247cf7c1/data/transactions/logic/eval.go#L1302
export const MAX_INPUT_BYTE_LEN = 64;
export const MAX_OUTPUT_BYTE_LEN = 128;

export const MaxTxnLife = 1000;
export const BlockFinalisationTime = 4n; // block finalisation time in seconds truncated down

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
	ApprovalProgramPages: null,
	ClearStateProgramPages: null,
	NumApprovalProgramPages: null,
	NumClearStateProgramPages: null,
	FirstValidTime: null,
};
TxnFields[8] = cloneDeep(TxnFields[7]);

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

ITxnFields[8] = {
	...ITxnFields[7],
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
TxArrFields[7] = new Set([...TxArrFields[6], "ApprovalProgramPages", "ClearStateProgramPages"]);
TxArrFields[8] = cloneDeep(TxArrFields[7]);

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
ITxArrFields[8] = cloneDeep(ITxArrFields[7]);

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
AssetParamMap[8] = { ...AssetParamMap[7] };

// https://developer.algorand.org/docs/get-details/dapps/avm/teal/opcodes/?from_query=opcode#asset_params_get-f
export enum AssetParamGetField {
	AssetTotal = "AssetTotal",
	AssetDecimals = "AssetDecimals",
	AssetDefaultFrozen = "AssetDefaultFrozen",
	AssetUnitName = "AssetUnitName",
	AssetName = "AssetName",
	AssetURL = "AssetURL",
	AssetMetadataHash = "AssetMetadataHash",
	AssetManager = "AssetManager",
	AssetReserve = "AssetReserve",
	AssetFreeze = "AssetFreeze",
	AssetClawback = "AssetClawback",
	AssetCreator = "AssetCreator",
}

export const AssetParamMapIndex = [
	AssetParamGetField.AssetTotal,
	AssetParamGetField.AssetDecimals,
	AssetParamGetField.AssetDefaultFrozen,
	AssetParamGetField.AssetUnitName,
	AssetParamGetField.AssetName,
	AssetParamGetField.AssetURL,
	AssetParamGetField.AssetMetadataHash,
	AssetParamGetField.AssetManager,
	AssetParamGetField.AssetReserve,
	AssetParamGetField.AssetFreeze,
	AssetParamGetField.AssetClawback,
	AssetParamGetField.AssetCreator,
];

// https://developer.algorand.org/docs/get-details/dapps/avm/teal/opcodes/?from_query=opcode#app_params_get-f
export enum AppParamField {
	AppApprovalProgram = "AppApprovalProgram",
	AppClearStateProgram = "AppClearStateProgram",
	AppGlobalNumUint = "AppGlobalNumUint",
	AppGlobalNumByteSlice = "AppGlobalNumByteSlice",
	AppLocalNumUint = "AppLocalNumUint",
	AppLocalNumByteSlice = "AppLocalNumByteSlice",
	AppExtraProgramPages = "AppExtraProgramPages",
	AppCreator = "AppCreator",
	AppAddress = "AppAddress",
}

export const AppParamDefinedIndex = [
	AppParamField.AppApprovalProgram,
	AppParamField.AppClearStateProgram,
	AppParamField.AppGlobalNumUint,
	AppParamField.AppGlobalNumByteSlice,
	AppParamField.AppLocalNumUint,
	AppParamField.AppLocalNumByteSlice,
	AppParamField.AppExtraProgramPages,
	AppParamField.AppCreator,
	AppParamField.AppAddress,
];

// https://developer.algorand.org/docs/get-details/dapps/avm/teal/opcodes/?from_query=opcode#app_params_get-f
export enum TxnRefFields {
	ApplicationArgs = "ApplicationArgs",
	ConfigAssetTotal = "ConfigAssetTotal",
	ConfigAssetDecimals = "ConfigAssetDecimals",
	ConfigAssetDefaultFrozen = "ConfigAssetDefaultFrozen",
	ConfigAssetUnitName = "ConfigAssetUnitName",
	ConfigAssetName = "ConfigAssetName",
	ConfigAssetURL = "ConfigAssetURL",
	ConfigAssetMetadataHash = "ConfigAssetMetadataHash",
	ConfigAssetManager = "ConfigAssetManager",
	ConfigAssetReserve = "ConfigAssetReserve",
	ConfigAssetFreeze = "ConfigAssetFreeze",
	ConfigAssetClawback = "ConfigAssetClawback",
	CreatedAssetID = "CreatedAssetID",
	CreatedApplicationID = "CreatedApplicationID",
	FirstValidTime = "FirstValidTime",
	FreezeAssetAccount = "FreezeAssetAccount",
	FreezeAssetFrozen = "FreezeAssetFrozen",
	Global = "Global",
	GlobalNumUint = "GlobalNumUint",
	GroupIndex = "GroupIndex",
	GlobalNumByteSlice = "GlobalNumByteSlice",
	LocalNumByteSlice = "LocalNumByteSlice",
	LocalNumUint = "LocalNumUint",
	NumAppArgs = "NumAppArgs",
	NumAccounts = "NumAccounts",
	NumAssets = "NumAssets",
	NumApplications = "NumApplications",
	NumApprovalProgramPages = "NumApprovalProgramPages",
	NumClearStateProgramPages = "NumClearStateProgramPages",
	NumLogs = "NumLogs",
	OnCompletion = "OnCompletion",
	TxID = "TxID",
}

// https://developer.algorand.org/docs/get-details/dapps/avm/teal/opcodes/?from_query=opcode#txna-f-i
export enum TxnaField {
	Accounts = "Accounts",
	ApprovalProgramPages = "ApprovalProgramPages",
	Applications = "Applications",
	ApplicationArgs = "ApplicationArgs",
	Assets = "Assets",
	ClearStateProgramPages = "ClearStateProgramPages",
	Logs = "Logs",
}

// app param use for app_params_get opcode
export const AppParamDefined: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set([
		AppParamField.AppApprovalProgram,
		AppParamField.AppClearStateProgram,
		AppParamField.AppGlobalNumUint,
		AppParamField.AppGlobalNumByteSlice,
		AppParamField.AppLocalNumUint,
		AppParamField.AppLocalNumByteSlice,
		AppParamField.AppExtraProgramPages,
		AppParamField.AppCreator,
		AppParamField.AppAddress,
	]),
};

AppParamDefined[6] = cloneDeep(AppParamDefined[5]);
AppParamDefined[7] = cloneDeep(AppParamDefined[6]);
AppParamDefined[8] = cloneDeep(AppParamDefined[7]);

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
		MaxTxnLife: MaxTxnLife,
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

GlobalFields[8] = {
	...GlobalFields[7],
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
	ed25519verify_bare: 1900,
	ecdsa_verify: 2500,
	ecdsa_pk_decompress: 2400,
	vrf_verify: 5700,
};
OpGasCost[8] = {
	...OpGasCost[7],
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

export const json_refTypes = {
	JSONString: "JSONString",
	JSONUint64: "JSONUint64",
	JSONObject: "JSONObject",
};

export enum blockFieldTypes {
	BlkTimestamp = "BlkTimestamp",
	BlkSeed = "BlkSeed",
}

export const blockFieldIndex = [blockFieldTypes.BlkSeed, blockFieldTypes.BlkTimestamp];

export enum vrfVerifyFieldTypes {
	VrfAlgorand = "VrfAlgorand",
	VrfStandard = "VrfStandard",
}

// CallerApplicationAddress
export enum GlobalField {
	CallerApplicationAddress = "CallerApplicationAddress",
	CallerApplicationID = "CallerApplicationID",
	CurrentApplicationAddress = "CurrentApplicationAddress",
	CreatorAddress = "CreatorAddress",
	CurrentApplicationID = "CurrentApplicationID",
	GroupSize = "GroupSize",
	GroupID = "GroupID",
	LatestTimestamp = "LatestTimestamp",
	LogicSigVersion = "LogicSigVersion",
	MaxTxnLife = "MaxTxnLife",
	MinTxnFee = "MinTxnFee",
	MinBalance = "MinBalance",
	OpcodeBudget = "OpcodeBudget",
	Round = "Round",
	ZeroAddress = "ZeroAddress",
}

export const GlobalFieldsIndex = [
	GlobalField.MinTxnFee,
	GlobalField.MinBalance,
	GlobalField.MaxTxnLife,
	GlobalField.ZeroAddress,
	GlobalField.GroupSize,
	GlobalField.LogicSigVersion,
	GlobalField.Round,
	GlobalField.LatestTimestamp,
	GlobalField.CurrentApplicationID,
	GlobalField.CreatorAddress,
	GlobalField.CurrentApplicationAddress,
	GlobalField.GroupID,
	GlobalField.OpcodeBudget,
	GlobalField.CallerApplicationID,
	GlobalField.CallerApplicationAddress,
];

export enum OpCodeField {
	AcctBalance = "AcctBalance",
	Amount = "Amount",
	CloseRemainderTo = "CloseRemainderTo",
	Fee = "Fee",
	FirstValid = "FirstValid",
	FirstValidTime = "FirstValidTime",
	LastValid = "LastValid",
	Lease = "Lease",
	Note = "Note",
	Receiver = "Receiver",
	Sender = "Sender",
	VotePK = "VotePK",
}

export enum AssetHoldingField {
	AssetBalance = "AssetBalance",
	AssetFrozen = "AssetFrozen",
}

// https://developer.algorand.org/docs/get-details/dapps/avm/teal/opcodes/?from_query=opcode#acct_params_get-f
export enum AccountParamGetField {
	AcctAuthAddr = "AcctAuthAddr",
	AcctBalance = "AcctBalance",
	AcctMinBalance = "AcctMinBalance",
}

export const AcctParamQueryFieldsIndex = [
	AccountParamGetField.AcctBalance,
	AccountParamGetField.AcctMinBalance,
	AccountParamGetField.AcctAuthAddr,
];

// https://developer.algorand.org/docs/get-details/transactions/transactions/#common-fields-header-and-type
export enum TxFieldEnum {
	Amount = "Amount",
	Accounts = "Accounts",
	ApplicationID = "ApplicationID",
	ApprovalProgram = "ApprovalProgram",
	AppArguments = "App Arguments",
	AssetAmount = "AssetAmount",
	AssetSender = "AssetSender",
	AssetReceiver = "AssetReceiver",
	AssetCloseTo = "AssetCloseTo",
	AssetName = "AssetName",
	AssetParams = "AssetParams",
	AssetFrozen = "AssetFrozen",
	ClawbackAddr = "ClawbackAddr",
	ClearStateProgram = "ClearStateProgram",
	CloseRemainderTo = "CloseRemainderTo",
	ConfigAsset = "ConfigAsset",
	FreezeAccount = "FreezeAccount",
	Decimals = "Decimals",
	DefaultFrozen = "DefaultFrozen",
	ExtraProgramPages = "ExtraProgramPages",
	Fee = "Fee",
	FreezeAddr = "FreezeAddr",
	FreezeAsset = "FreezeAsset",
	ForeignAssets = "ForeignAssets",
	FirstValid = "FirstValid",
	ForeignApps = "ForeignApps",
	GenesisHash = "GenesisHash",
	GlobalStateSchema = "GlobalStateSchema",
	Group = "Group",
	LastLog = "LastLog",
	Lease = "Lease",
	LastValid = "LastValid",
	LogicSig = "LogicSig",
	LocalStateSchema = "LocalStateSchema",
	ManagerAddr = "ManagerAddr",
	MetaDataHash = "MetaDataHash",
	Msig = "Msig",
	Note = "Note",
	Nonparticipation = "Nonparticipation",
	NumberByteSlices = "NumberByteSlices",
	NumberInts = "NumberInts",
	OnComplete = "OnComplete",
	OpcodeBudget = "OpcodeBudget",
	RekeyTo = "RekeyTo",
	Receiver = "Receiver",
	ReserveAddr = "ReserveAddr",
	SelectionPK = "SelectionPK",
	StateProofPK = "StateProofPK",
	Sender = "Sender",
	Sig = "Sig",
	Total = "Total",
	Transaction = "Transaction",
	TypeEnum = "TypeEnum",
	Type = "Type",
	TxType = "TxType",
	UnitName = "UnitName",
	URL = "URL",
	VotePK = "VotePK",
	VoteFirst = "VoteFirst",
	VoteLast = "VoteLast",
	VoteKeyDilution = "VoteKeyDilution",
	XferAsset = "XferAsset",
}

export const TxnFieldsIndex = [
	TxFieldEnum.Sender,
	TxFieldEnum.Fee,
	TxFieldEnum.FirstValid,
	TxnRefFields.FirstValidTime,
	TxFieldEnum.LastValid,
	TxFieldEnum.Note,
	TxFieldEnum.Lease,
	TxFieldEnum.Receiver,
	TxFieldEnum.Amount,
	TxFieldEnum.CloseRemainderTo,
	TxFieldEnum.VotePK,
	TxFieldEnum.SelectionPK,
	TxFieldEnum.VoteFirst,
	TxFieldEnum.VoteLast,
	TxFieldEnum.VoteKeyDilution,
	TxFieldEnum.Type,
	TxFieldEnum.TypeEnum,
	TxFieldEnum.XferAsset,
	TxFieldEnum.AssetAmount,
	TxFieldEnum.AssetSender,
	TxFieldEnum.AssetReceiver,
	TxFieldEnum.AssetCloseTo,
	TxnRefFields.GroupIndex,
	TxnRefFields.TxID,
	TxFieldEnum.ApplicationID,
	TxnRefFields.OnCompletion,
	TxnRefFields.ApplicationArgs,
	TxnRefFields.NumAppArgs,
	TxFieldEnum.Accounts,
	TxnRefFields.NumAccounts,
	TxFieldEnum.ApprovalProgram,
	TxFieldEnum.ClearStateProgram,
	TxFieldEnum.RekeyTo,
	TxFieldEnum.ConfigAsset,
	TxnRefFields.ConfigAssetTotal,
	TxnRefFields.ConfigAssetDecimals,
	TxnRefFields.ConfigAssetDefaultFrozen,
	TxnRefFields.ConfigAssetUnitName,
	TxnRefFields.ConfigAssetName,
	TxnRefFields.ConfigAssetURL,
	TxnRefFields.ConfigAssetMetadataHash,
	TxnRefFields.ConfigAssetManager,
	TxnRefFields.ConfigAssetReserve,
	TxnRefFields.ConfigAssetFreeze,
	TxnRefFields.ConfigAssetClawback,
	TxFieldEnum.FreezeAsset,
	TxnRefFields.FreezeAssetAccount,
	TxnRefFields.FreezeAssetFrozen,
	TxnaField.Assets,
	TxnRefFields.NumAssets,
	TxnaField.Applications,
	TxnRefFields.NumApplications,
	TxnRefFields.GlobalNumUint,
	TxnRefFields.GlobalNumByteSlice,
	TxnRefFields.LocalNumUint,
	TxnRefFields.LocalNumByteSlice,
	TxFieldEnum.ExtraProgramPages,
	TxFieldEnum.Nonparticipation,
	TxnaField.Logs,
	TxnRefFields.NumLogs,
	TxnRefFields.CreatedAssetID,
	TxnRefFields.CreatedApplicationID,
	TxFieldEnum.LastLog,
	TxFieldEnum.StateProofPK,
	TxnaField.ApprovalProgramPages,
	TxnRefFields.NumApprovalProgramPages,
	TxnaField.ClearStateProgramPages,
	TxnRefFields.NumClearStateProgramPages,
];

// https://developer.algorand.org/docs/get-details/dapps/avm/teal/opcodes/?from_query=opcode#base64_decode-e
export enum Base64Encoding {
	StdEncoding = "StdEncoding",
	URLEncoding = "URLEncoding",
}

export enum CurveTypeEnum {
	secp256k1 = "secp256k1",
	secp256r1 = "p256", // alias used in the library for secp256r1
}

export enum CurveTypeArgument {
	secp256k1 = "Secp256k1",
	secp256r1 = "Secp256r1",
}

export const CurveTypeIndex = [CurveTypeArgument.secp256k1, CurveTypeArgument.secp256r1];

export enum NumIndex {
	index_0 = "0",
	index_1 = "1",
	index_2 = "2",
}

export const JS_CONFIG_FILENAME = "algob.config.js";
export const TS_CONFIG_FILENAME = "algob.config.ts";
export const NETWORK_DEFAULT = "default";

export const PythonCommands = ['python3', 'python', 'py'] as const;
export type PythonCommand = typeof PythonCommands[number];
