export interface ErrorDescriptor {
	number: number;
	message: string;
	title: string;
	description: string;
}

export const RUNTIME_ERROR_RANGES = {
	TEAL: { min: 1000, max: 1099, title: "TEAL execution errors" },
	GENERAL: { min: 1300, max: 1399, title: "Runtime General Error" },
	TRANSACTION: { min: 1400, max: 1499, title: "Transaction error" },
	ASA: { min: 1500, max: 1599, title: "ASA Error" },
};

export const PARSE_ERROR = "Parse Error";

const tealErrors = {
	ASSERT_STACK_LENGTH: {
		number: 1000,
		message: "Length of stack is less than min length required for current op at line %line%",
		title: "Length of stack is less than min length required for current op at line %line%",
		description: `You are trying to perform an operation on stack where the stack does not
have sufficient length.`,
	},
	ASSERT_ARR_LENGTH: {
		number: 1001,
		message: "Length of block exceeded 256 or is equal to 0 at line %line%",
		title: "Invalid Block length at line %line%",
		description: `The size of provided block of []bytes/uint64 is not within the
permissible range of 1 to 256`,
	},
	INVALID_OP_ARG: {
		number: 1002,
		message:
			'Opcode "%opcode%" is invalid or does not exist for teal version #%version% at line %line%',
		title: "Invalid Operation",
		description: `Error encountered in stack while executing teal opcode %opcode%`,
	},
	INVALID_TYPE: {
		number: 1003,
		message: "Type of data is incorrect. Expected %expected% but got %actual% at line %line%",
		title: "Invalid type at line %line%",
		description: `Error encountered while executing teal code. Type of data is
incorrect. Expected %expected% but got %actual% at line %line%`,
	},
	UINT64_OVERFLOW: {
		number: 1004,
		message: "Result of current operation caused integer overflow at line %line%",
		title: "Uint64 Overflow at line %line%",
		description: `You are tying to perform operation where the result has exceeded
maximun uint64 value of 18446744073709551615`,
	},
	UINT64_UNDERFLOW: {
		number: 1005,
		message: "Result of current operation caused integer underflow at line %line%",
		title: "Uint64 Underflow at line %line%",
		description: `You are tying to perform operation where the result is less than
minimum uint64 value of 0`,
	},
	ZERO_DIV: {
		number: 1006,
		message: "Runtime Error - Division by zero at line %line%",
		title: "Division by zero at line %line%",
		description: `Runtime error occured. Cannot divide by zero`,
	},
	REJECTED_BY_LOGIC: {
		number: 1007,
		message: "Teal code rejected by logic",
		title: "Teal Rejection Error",
		description: `Teal code rejected because stack doesn't contain a single non-zero uint64 value`,
	},
	INDEX_OUT_OF_BOUND: {
		number: 1008,
		message: "Index out of bound at line %line%",
		title: "Index out of bound at line %line%",
		description: `Segmentation fault - The teal code tried to access a value
by an index that does not exist.`,
	},
	TEAL_ENCOUNTERED_ERR: {
		number: 1009,
		message: "TEAL runtime encountered err opcode at line %line%",
		title: "TEAL runtime encountered err opcode at line %line%",
		description: `TEAL encountered err opcode while executing TEAL code`,
	},
	CONCAT_ERROR: {
		number: 1010,
		message: "concat resulted in string too long at line %line%",
		title: "concat resulted in string too long at line %line%",
		description: `concat panics if the result would be greater than 4096 bytes.`,
	},
	LONG_INPUT_ERROR: {
		number: 1011,
		message: "Input is longer than 8 bytes at line %line%",
		title: "Input is longer than 8 bytes at line %line%",
		description: `Input is longer than 8 bytes.`,
	},
	SUBSTRING_END_BEFORE_START: {
		number: 1012,
		message: "substring end before start at line %line%",
		title: "substring end before start at line %line%",
		description: `substring end before start.`,
	},
	SUBSTRING_RANGE_BEYOND: {
		number: 1013,
		message: "substring range beyond length of string at line %line%",
		title: "substring range beyond length of string at line %line%",
		description: `substring range beyond length of string.`,
	},
	INVALID_UINT8: {
		number: 1014,
		message: "Input is not uint8 at line %line%",
		title: "Input is outside the valid uint8 range of 0 to 255 at line %line%",
		description: `Input is outside the valid uint8 range of 0 to 255`,
	},
	ASSERT_LENGTH: {
		number: 1015,
		message: "Invalid Field Length Expected: '%exp%' Got: '%got%', Line : %line% ",
		title: PARSE_ERROR,
		description: `Expected: '%exp%' Got: '%got%`,
	},
	INVALID_ADDR: {
		number: 1016,
		message: "Invalid Address '%addr%', Line: %line%",
		title: PARSE_ERROR,
		description: `Invalid Address '%addr%`,
	},
	PRAGMA_VERSION_ERROR: {
		number: 1017,
		message:
			"Pragma version Error - Expected version up to: %expected%, got: %got%, Line: %line%",
		title: PARSE_ERROR,
		description: ``,
	},
	INVALID_BASE64: {
		number: 1018,
		message: "Invalid Base64 Error - value %val% is not base64, Line: %line%",
		title: PARSE_ERROR,
		description: `value %exp% is not base64`,
	},
	INVALID_BASE32: {
		number: 1019,
		message: "Invalid Base32 Error - value %val% is not base32, Line: %line%",
		title: PARSE_ERROR,
		description: `value %exp% is not base32`,
	},
	DECODE_ERROR: {
		number: 1020,
		message: "Invalid Decode Data - value %val% is invalid, Line: %line%",
		title: "Decode Error",
		description: `value %exp%`,
	},
	UNKOWN_DECODE_TYPE: {
		number: 1021,
		message: "Invalid Decode Type - value %val% is unknown, Line: %line%",
		title: "Unkown Decode Type",
		description: `value %exp% is unknown`,
	},
	INVALID_SCHEMA: {
		number: 1022,
		message: "State Schema is invalid",
		title: "TEAL operations resulted in invalid schema",
		description: `TEAL operations resulted in invalid schema`,
	},
	LABEL_NOT_FOUND: {
		number: 1023,
		message: "Label not found at line %line%",
		title: "Label %label% not found at line %line%",
		description: `Label %label% not found`,
	},
	INVALID_LABEL: {
		number: 1024,
		message: "Invalid Label Name at line %line%",
		title: "OpCode name cannot be used as label name at line %line%",
		description: `OpCode name cannot be used as label name`,
	},
	UNKNOWN_TRANSACTION_FIELD: {
		number: 1025,
		message:
			'Transaction Field Error - Unknown transaction field "%field%" for teal version #%version% at line %line%',
		title: "Transaction Field Error at line %line%",
		description: `Transaction Field unknown`,
	},
	UNKNOWN_GLOBAL_FIELD: {
		number: 1026,
		message:
			'Global Field Error - Unknown Global field "%field%" for teal version #%version% at line %line%',
		title: "Global Field Error at line %line%",
		description: `Global Field unknown`,
	},
	UNKNOWN_ASSET_FIELD: {
		number: 1027,
		message:
			"Asset Field Error - Unknown Field:  %field% at line %line% for teal version #%tealV%",
		title: "Asset Field Error at line %line%",
		description: `Asset field unknown`,
	},
	UNKNOWN_OPCODE: {
		number: 1028,
		message:
			'Error encountered while parsing teal file: unknown opcode "%opcode%" for teal version #%version%, Line: %line% ',
		title: PARSE_ERROR,
		description: `Unknown Opcode encountered`,
	},
	MAX_COST_EXCEEDED: {
		number: 1029,
		message: "Cost of provided TEAL code = %cost% exceeds max cost of %maxcost%, Mode: %mode%",
		title: "MaxCost Error",
		description: `MaxCost Error`,
	},
	MAX_LEN_EXCEEDED: {
		number: 1030,
		message:
			"Length of provided TEAL code = %length% exceeds max length of %maxlen%, Mode: %mode%",
		title: "MaxLength Error",
		description: `MaxLength Error`,
	},
	PRAGMA_NOT_AT_FIRST_LINE: {
		number: 1031,
		message: "#pragma statement must be at 1st line. [error-line: %line%]",
		title: "#pragma error",
		description: `#pragma error`,
	},
	SET_BIT_VALUE_ERROR: {
		number: 1032,
		message: "set bit value is greater than 1. [error-line: %line%]",
		title: "Bit value error",
		description: `Bit value error`,
	},
	SET_BIT_INDEX_ERROR: {
		number: 1033,
		message: "set bit index %index% is greater than 63 with Uint. [error-line: %line%]",
		title: "set bit index error",
		description: `set bit index error`,
	},
	SET_BIT_INDEX_BYTES_ERROR: {
		number: 1034,
		message: "set bit index %index% is beyond bytes length. [error-line: %line%]",
		title: "set bit index error",
		description: `set bit index error`,
	},
	SCRATCH_EXIST_ERROR: {
		number: 1035,
		message:
			"scratch space doesn't exist for index: %index%. [error-line: %line%], fails maybe because the requested transaction is an ApplicationCall or T < GroupIndex.",
		title: "scratch space not found",
		description: `fails maybe because the requested transaction is an ApplicationCall or T < GroupIndex.`,
	},
	BYTES_LEN_EXCEEDED: {
		number: 1036,
		message:
			"Byteslice Arithmetic Error: length of input/output bytes(= %len%) exceed max length of %expected%. [error-line: %line%]",
		title: "Byteslice Arithmetic Error",
		description: `length of input/output bytes exceed max length`,
	},
	ADDR_NOT_FOUND_IN_TXN_ACCOUNT: {
		number: 1037,
		message:
			"address %address% not found in Txn.Accounts AND is not equal to Txn.Sender OR CurrentApplicationAddress. [error-line: %line%]",
		title: "Address not found in Txn",
		description: `Address should be present in Txn.Account OR should be Txn.Sender`,
	},
	INVALID_APP_REFERENCE: {
		number: 1038,
		message:
			"Application Reference %appRef% not found in Transaction(foreignApps/appID). [error-line: %line%]",
		title: "Invalid APP Reference",
		description: `Invalid APP Reference: Application index not found in Txn`,
	},
	INVALID_ASA_REFERENCE: {
		number: 1039,
		message:
			"ASA Reference %assetRef% not found in Transaction(foreignAssets/assetID). [error-line: %line%]",
		title: "Invalid ASA Reference",
		description: `Invalid ASA Reference: Asset index not found in Txn`,
	},
	CALL_STACK_EMPTY: {
		number: 1040,
		message: "There is no callsub before retsub, call stack is empty. [error-line: %line%]",
		title: "call stack error",
		description: `There is no callsub before retsub, call stack is empty`,
	},
	UINT128_OVERFLOW: {
		number: 1041,
		message: "Result of current operation caused U128 integer overflow at line %line%",
		title: "Uint128 Overflow at line %line%",
		description: `You are tying to perform operation where the result has exceeded
maximun uint128`,
	},
	EXP_ERROR: {
		number: 1042,
		message: "A == 0 and B == 0 in exponentiation at line %line%",
		title: "A == B == 0 at line %line%",
		description: `You are tying to perform operation where A = B = 0`,
	},
	GROUP_INDEX_EXIST_ERROR: {
		number: 1043,
		message:
			"Requested transaction hasn't created an asset or application for index: %index%. [error-line: %line%], requested transaction didn't create an asset or application or T < GroupIndex",
		title: "Requested transaction not found",
		description: `requested transaction didn't creat an asset or application or T < GroupIndex.`,
	},
	EXTRACT_RANGE_ERROR: {
		number: 1044,
		message: "Extract range beyond length of string",
		title: "Extract range beyond length of string (given: %given%, length: %length%)",
		description: `Extract range beyond length of string`,
	},
	CURVE_NOT_SUPPORTED: {
		number: 1045,
		message: "Curve index: %index% is not supported. [error-line: %line%]",
		title: "curve not supported",
		description: `curve index is not supported.`,
	},
	ITXN_BEGIN_WITHOUT_ITXN_SUBMIT: {
		number: 1046,
		message:
			"itxn_begin without itxn_submit: an inner transaction is already being configured, at line %line%",
		title: "itxn_begin without itxn_submit",
		description: `itxn_begin without itxn_submit`,
	},
	ITXN_FIELD_WITHOUT_ITXN_BEGIN: {
		number: 1047,
		message:
			"itxn_field without itxn_begin: tring to set inner transaction field without inner tx begin, at line %line%",
		title: "itxn_field without itxn_begin",
		description: `itxn_field without itxn_begin`,
	},
	ITXN_FIELD_ERR: {
		number: 1048,
		message:
			"execution of itxn_field %field% failed. Message: %msg%. Teal version: #%tealV%, [error-line: %line%]",
		title: "execution of itxn_field %field% failed",
		description: `execution of itxn_field %field% failed`,
	},
	ITXN_SUBMIT_WITHOUT_ITXN_BEGIN: {
		number: 1049,
		message:
			"itxn_submit without itxn_begin: trying to submit an inner transaction without begin, at line %line%",
		title: "itxn_submit without itxn_begin",
		description: `itxn_submit without itxn_begin`,
	},
	NO_INNER_TRANSACTION_AVAILABLE: {
		number: 1049,
		message:
			"No inner transaction available. Teal version: #%tealVersion%, [error-line: %line%]",
		title: "No inner transaction available.",
		description: `No inner transaction available.`,
	},
	ADDR_NOT_VALID: {
		number: 1050,
		message: "Address %address% is not a valid Algorand address, at line %line%",
		title: "Address not valid",
		description: `Address not valid`,
	},
	LOGS_COUNT_EXCEEDED_THRESHOLD: {
		number: 1051,
		message: "Maximum number of logs exceeded threshold of %maxLogs%, at line %line%",
		title: "Maximum number of logs exceeded",
		description: `Maximum number of logs exceeded`,
	},
	LOGS_LENGTH_EXCEEDED_THRESHOLD: {
		number: 1052,
		message:
			"Maximum length (in bytes) of logs exceeded threshold of %maxLength%, but got %origLength%, at line %line%",
		title: "Maximum length (in bytes) of logs exceeded",
		description: `Maximum length (in bytes) of logs exceeded`,
	},
	UNKNOWN_APP_FIELD: {
		number: 1053,
		message:
			"App Field Error - Unknown Field:  %field% at line %line% for teal version #%tealV%",
		title: "App Field Error at line %line%",
		description: `App field unknown`,
	},
	EXECUTION_MODE_NOT_VALID: {
		number: 1054,
		message:
			"Opcode %opcode% is only allowed in %allowedIn% mode, but was run in %ranIn% mode. Teal version #%tealV%, [error-line: %line%]",
		title: "Execution mode not valid",
		description: `Execution mode not valid`,
	},
	PROGRAM_VERSION_MISMATCH: {
		number: 1055,
		message: "program version mismatch %approvalVersion != %clearVersion",
		title: "program version mismatch %approvalVersion != %clearVersion.",
		description: "program version mismatch",
	},
	UNKNOWN_ACCT_FIELD: {
		number: 1056,
		message:
			"Account Field Error - Unknown Field:  %field% at line %line% for teal version #%tealV%",
		title: "Account Field Error at line %line%",
		description: `Account field unknown`,
	},
	ITXN_NEXT_WITHOUT_ITXN_BEGIN: {
		number: 1057,
		message:
			"itxn_next without itxn_begin: trying to submit an inner transaction without begin, at line %line%",
		title: "itxn_next without itxn_begin",
		description: `itxn_next without itxn_begin`,
	},
	UNKNOWN_ENCODING: {
		number: 1058,
		message: "Encoding e must be {URLEncoding, StdEncoding}, got :%encoding%, at line %line%",
		title: "Unknown encoding",
		description: "Unknown encoding",
	},
	INVALID_BASE64URL: {
		number: 1059,
		message: "Invalid Base64Url Error - value %val% is not base64Url, Line: %line%",
		title: PARSE_ERROR,
		description: `value %exp% is not base64Url`,
	},
	ISSUE_ITXN_WHEN_CLEAR_PROGRAM: {
		number: 1060,
		message: "Clear state programs cannot issue inner transactions.",
		title: "Clear state programs cannot issue inner transactions.",
		description: "Clear state programs cannot issue inner transactions",
	},
	BYTES_REPLACE_ERROR: {
		number: 1061,
		message: "Can not replace bytes due to length of replacing bytes(%lenReplace%) + index replace(%index%) > length of original bytes(%lenOriginal%) at line %line%",
		title: "replace opcode error",
		description: "Can not replace bytes due to invalid start or end index",
	},
};

const runtimeGeneralErrors = {
	LOGIC_SIGNATURE_NOT_FOUND: {
		number: 1300,
		message: "logic signature not found",
		title: "lsig error",
		description: `lsig error`,
	},
	LOGIC_SIGNATURE_VALIDATION_FAILED: {
		number: 1301,
		message: "logic signature validation failed. address: %address%",
		title: "lsig validation error",
		description: `lsig validation error`,
	},
	INVALID_ROUND: {
		number: 1302,
		message:
			"Transaction rounds (firstValid: %first%, lastValid: %last%) are not valid, current round: %round%.",
		title: "Round Error",
		description: `Round Error`,
	},
	MAX_LIMIT_APPS: {
		number: 1303,
		message:
			"Error while creating app for %address%. Maximum created apps for an account is %max%",
		title: "App Creation Error",
		description: `App Creation Error`,
	},
	INVALID_SECRET_KEY: {
		number: 1304,
		message: "invalid secret key: %secretkey%",
		title: "secret key error",
		description: `secret key error`,
	},
	ACCOUNT_DOES_NOT_EXIST: {
		number: 1305,
		message: "Account Error - Account %address% doesn't exist at line %line%",
		title: "Account Error at line %line%",
		description: `Account does not exist in the current state`,
	},
	APP_NOT_FOUND: {
		number: 1306,
		message: "Application Index %appID% not found or is invalid at line %line%",
		title: "Application index %appID% is not found line at %line%",
		description: `Application index %appID% is not found`,
	},
	INVALID_APPROVAL_PROGRAM: {
		number: 1307,
		message: "Approval program is empty",
		title: "Invalid approval program",
		description: `Invalid approval program`,
	},
	INVALID_CLEAR_PROGRAM: {
		number: 1308,
		message: "Clear program is empty",
		title: "Invalid clear program",
		description: `Invalid clear program`,
	},
	INVALID_PROGRAM: {
		number: 1309,
		message: "Program is empty",
		title: "Invalid program",
		description: `Invalid program`,
	},
	MULTIPLE_FILES_WITH_SAME_NAME_IN_DIR: {
		number: 1310,
		message: 'Directory %directory% has same file "%file%" in multiple paths: %path1%, %path2%',
		title: "Multiple files with same fileName present in directory %directory%",
		description: `Directory %directory% has same file in multiple paths: %path1%, %path2%`,
	},
	FILE_NOT_FOUND_IN_DIR: {
		number: 1311,
		message: 'File name "%file%" does not exist in directory "%directory%"',
		title: 'File "%file%" does not exist in directory "%directory%"',
		description: `File "%file%" does not exist in directory "%directory%"`,
	},
	INVALID_TX_ACCOUNTS_LEN: {
		number: 1312,
		message: "tx.Accounts too long, max number of accounts is %max%, got: %len%",
		title: "Transaction.Accounts exceeds max length",
		description: `Transaction.Accounts cannot exceed max length of %max%`,
	},
	INVALID_APP_ARGS_LEN: {
		number: 1313,
		message: "tx.AppArgs too long, max number of application args is %max%, got: %len%",
		title: "Transaction.ApplicationArgs exceeds max length",
		description: `Transaction.ApplicationArgs cannot exceed max length of %max%`,
	},
	MAX_REFERENCES_EXCEEDED: {
		number: 1314,
		message: "tx has too many references, max is %max%, got: %len%",
		title: "Transaction references(assets + apps + accounts) exceeds max length of %max%",
		description: `Transaction references cannot exceed max length of %max%`,
	},
	MAX_INNER_TRANSACTIONS_EXCEEDED: {
		number: 1315,
		message:
			"Attempt to create too many inner transactions, max is %max%, got: %len%, at line %line%",
		title: "Max inner transactions exceeded",
		description: `Inner transaction in a single call cannot be more than %max%`,
	},
	INVALID_AUTH_ACCOUNT: {
		number: 1316,
		message: "Should have been authorized by %spend% but was actually authorized by %signer%",
		title: "Invalid spend account.",
		description: "Invalid spend account",
	},
	ACCOUNT_ADDR_MISMATCH: {
		number: 1317,
		message: "Account Error - Account and address %address% mismatch at line %line%",
		title: "Account Error at line %line%",
		description: `Account and address mismatch in the current state`,
	},
	MAX_SCHEMA_ENTRIES_EXCEEDED: {
		number: 1318,
		message: "Local/Global state keys has too many entries",
		title: "Max schema entries exceeded",
		description:
			"Local key entires: used: %localState%, max: %localMax%. Global  key entires: used: %globalState, max: %globalMax%.",
	},
	APP_NAME_ALREADLY_USED: {
		number: 1319,
		message: "%appName% already used. Please choose another name.",
		title: "%appName% already used",
		description: "%appName% already used. Please choose another name.",
	},
	TOO_MANY_INNER_TXN: {
		number: 1320,
		message: "Too many inner transaction.",
		title: "Too many inner transaction.",
		description: "Too many inner transaction in one call, maximum is 256.",
	},
};

const transactionErrors = {
	TRANSACTION_TYPE_ERROR: {
		number: 1400,
		message: "Error. Transaction Type %transaction% is Unknown",
		title: "Unknown Transaction type",
		description: `Provided transaction type is unknown
    Please double check your transaction type`,
	},
	INSUFFICIENT_ACCOUNT_BALANCE: {
		number: 1401,
		message:
			"account %address% balance %accBalance% below minimum required balance: %minbalance%",
		title: "Insufficient account balance",
		description: `Algorand account balance below minimum required balance`,
	},
	INSUFFICIENT_ACCOUNT_ASSETS: {
		number: 1402,
		message: "Cannot withdraw %amount% assets from account %address%: insufficient balance",
		title: "Insufficient account assets",
		description: `Withdrawing %amount% assets will lead to insufficient balance`,
	},
	INVALID_TRANSACTION_PARAMS: {
		number: 1403,
		message: "Secret key and Logic Signature should not be passed together",
		title: "Transaction params error",
		description: `Transaction params error`,
	},
	ASA_NOT_OPTIN: {
		number: 1404,
		message: `Account %address% doesn't hold asset index %assetId%`,
		title: "Asset Not Opt-In",
		description: "Asset Holding Not Found",
	},
	ACCOUNT_ASSET_FROZEN: {
		number: 1405,
		message: `Asset index %assetId% frozen for account %address%`,
		title: "Asset Frozen",
		description: "Asset Frozen for account",
	},
	FEES_NOT_ENOUGH: {
		number: 1406,
		message: `Fee required %required% is greater than fee collected %collected%`,
		title: "Not enough fees",
		description: "Fees not enough to cover transaction cost",
	},
	INVALID_CLOSE_REMAINDER_TO: {
		number: 1407,
		message: "Transaction cannot close account to its sender",
		title: "Transaction cannot close account to its sender.",
		description: "Transaction cannot close account to its sender",
	},
	INNER_APP_CALL_INVALID_VERSION: {
		number: 1408,
		message: "Inner app call in older version %tealVersion%",
		title: "Inner app call with version %tealVersion%.",
		description: "Inner app call with version %tealVersion%",
	},
	INNER_APP_DEEP_EXCEEDED: {
		number: 1409,
		message: "Inner transaction appl deep exceeded",
		title: "Inner transaction appl deep exceeded.",
		description: "Inner transaction appl deep exceeded",
	},
	INNER_APP_SELF_CALL: {
		number: 1410,
		message: "Inner transaction appl self-call",
		title: "Inner transaction appl self-call.",
		description: "Inner transaction appl self-call",
	},
	TRANSACTION_ALREADY_IN_LEDGER: {
		number: 1411,
		message: "Transaction already in ledger",
		title: "Transaction already in ledger",
		description: "Transaction already in ledger.",
	},
};

const runtimeAsaErrors = {
	PARAM_PARSE_ERROR: {
		number: 1500,
		message: `Invalid ASA definition: '%source%'.
    Reason: %reason%`,
		title: "Invalid ASA definition",
		description: `Invalid ASA definition: '%source%'.
    Reason: %reason%
    Please check your ASA file`,
	},
	PARAM_ERROR_NO_NAMED_OPT_IN_ACCOUNT: {
		number: 1501,
		message: `Invalid ASA definition: '%source%'.
    Opt-in account not found by name: %optInAccName%`,
		title: "Opt-in account not found.",
		description: `Invalid ASA definition: '%source%'.
    Opt-in account not found by name: %optInAccName%
    Please check your ASA and config files`,
	},
	ASSET_NOT_FOUND: {
		number: 1502,
		message: `Asset with Index %assetId% not found`,
		title: "Asset Not Found",
		description: "Asset Not Found",
	},
	MAX_LIMIT_ASSETS: {
		number: 1503,
		message:
			"Error while creating asset %name% for %address%. Maximum created assets for an account is %max%",
		title: "Asset Creation Error",
		description: `Asset Creation Error`,
	},
	MANAGER_ERROR: {
		number: 1504,
		message: `Only Manager account %address% can modify or destroy asset`,
		title: "Manager Error",
		description: "Manager Error",
	},
	FREEZE_ERROR: {
		number: 1505,
		message: `Only Freeze account %address% can freeze asset`,
		title: "Freeze Error",
		description: "Freeze Error",
	},
	CLAWBACK_ERROR: {
		number: 1506,
		message: `Only Clawback account %address% can revoke asset`,
		title: "Clawback Error",
		description: "Clawback Error",
	},
	BLANK_ADDRESS_ERROR: {
		number: 1507,
		message: `Cannot reset a blank address`,
		title: "Blank Address Error",
		description: "Blank Address Error",
	},
	ASSET_TOTAL_ERROR: {
		number: 1508,
		message: "All of the created assets should be in creator's account",
		title: "Asset Total Error",
		description: "Asset Total Error",
	},
	CANNOT_CLOSE_ASSET_BY_CLAWBACK: {
		number: 1509,
		message: `Assetholding of account cannot be closed by clawback`,
		title: "Close asset by clawback error",
		description:
			"Clawback cannot close asset holding from an algorand account. Only the actual owner of that account can. Read more about asset parameters at https://developer.algorand.org/docs/features/asa/#asset-parameters",
	},
	CANNOT_CLOSE_ASSET_BY_CREATOR: {
		number: 1510,
		message: `Assetholding of creator account cannot be closed to another account`,
		title: "Cannot close asset ID in allocating account",
		description: "Asset holding of Asset creator cannot be closed to other account",
	},
	ASA_FILE_IS_UNDEFINED: {
		number: 1511,
		message: "ASA file is undefined.",
		title: "ASA file is undefined.",
		description: "Attempt to read an undefined ASA file (asa.yaml)",
	},
	ASA_DEFINITION_NO_FOUND_IN_ASA_FILE: {
		number: 1511,
		message: "ASA defition not found in asa file(asa.yaml)",
		title: "ASA definition not found in asa file(asa.yaml)",
		description: "ASA definition not found in asa file. Please check asa.yaml",
	},
};

export const RUNTIME_ERRORS: {
	[_category in keyof typeof RUNTIME_ERROR_RANGES]: {
		[errorName: string]: ErrorDescriptor;
	};
} = {
	GENERAL: runtimeGeneralErrors,
	TEAL: tealErrors,
	TRANSACTION: transactionErrors,
	ASA: runtimeAsaErrors,
};

export default RUNTIME_ERRORS;
