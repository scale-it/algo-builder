
export const RUNTIME_ERROR_PREFIX = "RUNTIME_ERR";

export interface ErrorDescriptor {
  number: number
  message: string
  title: string
  description: string
}

export function getRuntimeErrorCode (error: ErrorDescriptor): string {
  return `${RUNTIME_ERROR_PREFIX}${error.number}`;
}

export const RUNTIME_ERROR_RANGES = {
  TEAL: { min: 1000, max: 1099, title: "TEAL execution errors" },
  GENERAL: { min: 1300, max: 1399, title: "Runtime General Error" },
  TRANSACTION: { min: 1400, max: 1499, title: "Transaction error" },
  ASA: { min: 1500, max: 1599, title: "ASA Error" }
};

export const PARSE_ERROR = "Parse Error";

export const tealErrors = {
  ASSERT_STACK_LENGTH: {
    number: 1000,
    message: "Length of stack is less than min length required for current op at line %line%",
    title: "Length of stack is less than min length required for current op at line %line%",
    description: `You are trying to perform an operation on stack where the stack does not
have sufficient length.`
  },
  ASSERT_ARR_LENGTH: {
    number: 1001,
    message: "Length of block exceeded 256 or is equal to 0 at line %line%",
    title: "Invalid Block length at line %line%",
    description: `The size of provided block of []bytes/uint64 is not within the
permissible range of 1 to 256`
  },
  INVALID_OP_ARG: {
    number: 1002,
    message: "Error encountered while executing teal with opcode %opcode% for teal version #%version% at line %line%",
    title: "Invalid Operation",
    description: `Error encountered in stack while executing teal opcode %opcode%`
  },
  INVALID_TYPE: {
    number: 1003,
    message: "Type of data is incorrect. Expected %expected% but got %actual% at line %line%",
    title: "Invalid type at line %line%",
    description: `Error encountered while executing teal code. Type of data is
incorrect. Expected %expected% but got %actual% at line %line%`
  },
  UINT64_OVERFLOW: {
    number: 1004,
    message: "Result of current operation caused integer overflow at line %line%",
    title: "Uint64 Overflow at line %line%",
    description: `You are tying to perform operation where the result has exceeded
maximun uint64 value of 18446744073709551615`
  },
  UINT64_UNDERFLOW: {
    number: 1005,
    message: "Result of current operation caused integer underflow at line %line%",
    title: "Uint64 Underflow at line %line%",
    description: `You are tying to perform operation where the result is less than
minimum uint64 value of 0`
  },
  ZERO_DIV: {
    number: 1006,
    message: "Runtime Error - Division by zero at line %line%",
    title: "Division by zero at line %line%",
    description: `Runtime error occured. Cannot divide by zero`
  },
  REJECTED_BY_LOGIC: {
    number: 1007,
    message: "Teal code rejected by logic",
    title: "Teal Rejection Error",
    description: `Teal code rejected because stack doesn't contain a single non-zero uint64 value`
  },
  INDEX_OUT_OF_BOUND: {
    number: 1008,
    message: "Index out of bound at line %line%",
    title: "Index out of bound at line %line%",
    description: `Segmentation fault - The teal code tried to access a value
by an index that does not exist.`
  },
  TEAL_ENCOUNTERED_ERR: {
    number: 1009,
    message: "TEAL runtime encountered err opcode at line %line%",
    title: "TEAL runtime encountered err opcode at line %line%",
    description: `TEAL encountered err opcode while executing TEAL code`
  },
  CONCAT_ERROR: {
    number: 1010,
    message: "concat resulted in string too long at line %line%",
    title: "concat resulted in string too long at line %line%",
    description: `concat panics if the result would be greater than 4096 bytes.`
  },
  LONG_INPUT_ERROR: {
    number: 1011,
    message: "Input is longer than 8 bytes at line %line%",
    title: "Input is longer than 8 bytes at line %line%",
    description: `Input is longer than 8 bytes.`
  },
  SUBSTRING_END_BEFORE_START: {
    number: 1012,
    message: "substring end before start at line %line%",
    title: "substring end before start at line %line%",
    description: `substring end before start.`
  },
  SUBSTRING_RANGE_BEYOND: {
    number: 1013,
    message: "substring range beyond length of string at line %line%",
    title: "substring range beyond length of string at line %line%",
    description: `substring range beyond length of string.`
  },
  INVALID_UINT8: {
    number: 1014,
    message: "Input is not uint8 at line %line%",
    title: "Input is outside the valid uint8 range of 0 to 255 at line %line%",
    description: `Input is outside the valid uint8 range of 0 to 255`
  },
  ASSERT_LENGTH: {
    number: 1015,
    message: "Invalid Field Length Expected: '%exp%' Got: '%got%', Line : %line% ",
    title: PARSE_ERROR,
    description: `Expected: '%exp%' Got: '%got%`
  },
  INVALID_ADDR: {
    number: 1016,
    message: "Invalid Address '%addr%', Line: %line%",
    title: PARSE_ERROR,
    description: `Invalid Address '%addr%`
  },
  PRAGMA_VERSION_ERROR: {
    number: 1017,
    message: "Pragma version Error - Expected: version, got: %got%, Line: %line%",
    title: PARSE_ERROR,
    description: ``
  },
  INVALID_BASE64: {
    number: 1018,
    message: "Invalid Base64 Error - value %val% is not base64, Line: %line%",
    title: PARSE_ERROR,
    description: `value %exp% is not base64`
  },
  INVALID_BASE32: {
    number: 1019,
    message: "Invalid Base32 Error - value %val% is not base32, Line: %line%",
    title: PARSE_ERROR,
    description: `value %exp% is not base32`
  },
  DECODE_ERROR: {
    number: 1020,
    message: "Invalid Decode Data - value %val% is invalid, Line: %line%",
    title: "Decode Error",
    description: `value %exp%`
  },
  UNKOWN_DECODE_TYPE: {
    number: 1021,
    message: "Invalid Decode Type - value %val% is unknown, Line: %line%",
    title: "Unkown Decode Type",
    description: `value %exp% is unknown`
  },
  INVALID_SCHEMA: {
    number: 1022,
    message: "State Schema is invalid",
    title: "TEAL operations resulted in invalid schema",
    description: `TEAL operations resulted in invalid schema`
  },
  LABEL_NOT_FOUND: {
    number: 1023,
    message: "Label not found at line %line%",
    title: "Label %label% not found at line %line%",
    description: `Label %label% not found`
  },
  INVALID_LABEL: {
    number: 1024,
    message: "Invalid Label Name at line %line%",
    title: "OpCode name cannot be used as label name at line %line%",
    description: `OpCode name cannot be used as label name`
  },
  UNKNOWN_TRANSACTION_FIELD: {
    number: 1025,
    message: "Transaction Field Error - Unknown transaction field \"%field%\" for teal version #%version% at line %line%",
    title: "Transaction Field Error at line %line%",
    description: `Transaction Field unknown`
  },
  UNKNOWN_GLOBAL_FIELD: {
    number: 1026,
    message: "Global Field Error - Unknown Global field \"%field%\" for teal version #%version% at line %line%",
    title: "Global Field Error at line %line%",
    description: `Global Field unknown`
  },
  UNKNOWN_ASSET_FIELD: {
    number: 1027,
    message: "Asset Field Error - Unknown Field:  %field% at line %line%",
    title: "Asset Field Error at line %line%",
    description: `Asset field unknown`
  },
  UNKNOWN_OPCODE: {
    number: 1028,
    message: "Error encountered while parsing teal file: unknown opcode \"%opcode%\" for teal version #%version%, Line: %line% ",
    title: PARSE_ERROR,
    description: `Unknown Opcode encountered`
  },
  MAX_COST_EXCEEDED: {
    number: 1029,
    message: "Cost of provided TEAL code = %cost% exceeds max cost of %maxcost%, Mode: %mode%",
    title: 'MaxCost Error',
    description: `MaxCost Error`
  },
  MAX_LEN_EXCEEDED: {
    number: 1030,
    message: "Length of provided TEAL code = %length% exceeds max length of %maxlen%, Mode: %mode%",
    title: 'MaxLength Error',
    description: `MaxLength Error`
  },
  PRAGMA_NOT_AT_FIRST_LINE: {
    number: 1031,
    message: "#pragma statement must be at 1st line. [error-line: %line%]",
    title: '#pragma error',
    description: `#pragma error`
  },
  SET_BIT_VALUE_ERROR: {
    number: 1032,
    message: "set bit value is greater than 1. [error-line: %line%]",
    title: 'Bit value error',
    description: `Bit value error`
  },
  SET_BIT_INDEX_ERROR: {
    number: 1033,
    message: "set bit index %index% is greater than 63 with Uint. [error-line: %line%]",
    title: 'set bit index error',
    description: `set bit index error`
  },
  SET_BIT_INDEX_BYTES_ERROR: {
    number: 1034,
    message: "set bit index %index% is beyond bytes length. [error-line: %line%]",
    title: 'set bit index error',
    description: `set bit index error`
  }
};

export const runtimeGeneralErrors = {
  LOGIC_SIGNATURE_NOT_FOUND: {
    number: 1300,
    message: "logic signature not found",
    title: "lsig error",
    description: `lsig error`
  },
  LOGIC_SIGNATURE_VALIDATION_FAILED: {
    number: 1301,
    message: "logic signature validation failed. address: %address%",
    title: "lsig validation error",
    description: `lsig validation error`
  },
  INVALID_ROUND: {
    number: 1302,
    message: "Transaction rounds (firstValid: %first%, lastValid: %last%) are not valid, current round: %round%.",
    title: 'Round Error',
    description: `Round Error`
  },
  MAX_LIMIT_APPS: {
    number: 1303,
    message: "Error while creating app for %address%. Maximum created apps for an account is %max%",
    title: 'App Creation Error',
    description: `App Creation Error`
  },
  INVALID_SECRET_KEY: {
    number: 1304,
    message: "invalid secret key: %secretkey%",
    title: "secret key error",
    description: `secret key error`
  },
  ACCOUNT_DOES_NOT_EXIST: {
    number: 1305,
    message: "Account Error - Account %address% doesn't exist at line %line%",
    title: "Account Error at line %line%",
    description: `Account does not exist in the current state`
  },
  APP_NOT_FOUND: {
    number: 1306,
    message: "Application Index %appId% not found or is invalid at line %line%",
    title: "Application index %appId% is not found line at %line%",
    description: `Application index %appId% is not found`
  },
  INVALID_APPROVAL_PROGRAM: {
    number: 1307,
    message: "Approval program is empty",
    title: "Invalid approval program",
    description: `Invalid approval program`
  },
  INVALID_CLEAR_PROGRAM: {
    number: 1308,
    message: "Clear program is empty",
    title: "Invalid clear program",
    description: `Invalid clear program`
  },
  INVALID_PROGRAM: {
    number: 1309,
    message: "Program is empty",
    title: "Invalid program",
    description: `Invalid program`
  },
  MULTIPLE_FILES_WITH_SAME_NAME_IN_DIR: {
    number: 1310,
    message: "Directory %directory% has same file \"%file%\" in multiple paths: %path1%, %path2%",
    title: "Multiple files with same fileName present in directory %directory%",
    description: `Directory %directory% has same file in multiple paths: %path1%, %path2%`
  },
  FILE_NOT_FOUND_IN_DIR: {
    number: 1311,
    message: "File name \"%file%\" does not exist in directory \"%directory%\"",
    title: "File \"%file%\" does not exist in directory \"%directory%\"",
    description: `File "%file%" does not exist in directory "%directory%"`
  }
};

export const transactionErrors = {
  TRANSACTION_TYPE_ERROR: {
    number: 1400,
    message: "Error. Transaction Type %transaction% is Unknown",
    title: "Unknown Transaction type",
    description: `Provided transaction type is unknown
    Please double check your transaction type`
  },
  INSUFFICIENT_ACCOUNT_BALANCE: {
    number: 1401,
    message: "Cannot withdraw %amount% microalgos from account %address%: resulting balance would be insufficient",
    title: 'Insufficient account balance',
    description: `Withdrawing %amount% microalgos will lead to insufficient balance`
  },
  INSUFFICIENT_ACCOUNT_ASSETS: {
    number: 1402,
    message: "Cannot withdraw %amount% assets from account %address%: insufficient balance",
    title: 'Insufficient account assests',
    description: `Withdrawing %amount% assets will lead to insufficient balance`
  },
  INVALID_TRANSACTION_PARAMS: {
    number: 1403,
    message: "Secret key and Logic Signature should not be passed together",
    title: "Transaction params error",
    description: `Transaction params error`
  },
  ASA_NOT_OPTIN: {
    number: 1404,
    message: `Account %address% doesn't hold asset index %assetId%`,
    title: "Asset Not Opt-In",
    description: "Asset Holding Not Found"
  },
  ACCOUNT_ASSET_FROZEN: {
    number: 1505,
    message: `Asset index %assetId% frozen for account %address%`,
    title: "Asset Frozen",
    description: "Asset Frozen for account"
  }
};

export const runtimeAsaErrors = {
  PARAM_PARSE_ERROR: {
    number: 1500,
    message: `Invalid ASA definition: '%source%'.
    Reason: %reason%`,
    title: "Invalid ASA definition",
    description: `Invalid ASA definition: '%source%'.
    Reason: %reason%
    Please check your ASA file`
  },
  PARAM_ERROR_NO_NAMED_OPT_IN_ACCOUNT: {
    number: 1501,
    message: `Invalid ASA definition: '%source%'.
    Opt-in account not found by name: %optInAccName%`,
    title: "Opt-in account not found.",
    description: `Invalid ASA definition: '%source%'.
    Opt-in account not found by name: %optInAccName%
    Please check your ASA and config files`
  },
  ASSET_NOT_FOUND: {
    number: 1502,
    message: `Asset with Index %assetId% not found`,
    title: "Asset Not Found",
    description: "Asset Not Found"
  },
  MAX_LIMIT_ASSETS: {
    number: 1503,
    message: "Error while creating asset %name% for %address%. Maximum created assets for an account is %max%",
    title: 'Asset Creation Error',
    description: `Asset Creation Error`
  },
  MANAGER_ERROR: {
    number: 1504,
    message: `Only Manager account %address% can modify asset`,
    title: "Manager Error",
    description: "Manager Error"
  },
  FREEZE_ERROR: {
    number: 1505,
    message: `Only Freeze account %address% can freeze asset`,
    title: "Freeze Error",
    description: "Freeze Error"
  },
  CLAWBACK_ERROR: {
    number: 1506,
    message: `Only Clawback account %address% can revoke asset`,
    title: "Clawback Error",
    description: "Clawback Error"
  },
  BLANK_ADDRESS_ERROR: {
    number: 1507,
    message: `Cannot reset a blank address`,
    title: "Blank Address Error",
    description: "Blank Address Error"
  },
  ASSET_TOTAL_ERROR: {
    number: 1508,
    message: "All of the created assets should be in creator's account",
    title: "Asset Total Error",
    description: "Asset Total Error"
  },
  CANNOT_CLOSE_ASSET_BY_CLAWBACK: {
    number: 1509,
    message: `Assetholding of account cannot be closed by clawback`,
    title: "Close asset by clawback error",
    description: "Clawback cannot close asset holding from an algorand account. Only the actual owner of that account can. Read more about asset parameters at https://developer.algorand.org/docs/features/asa/#asset-parameters"
  },
  CANNOT_CLOSE_ASSET_BY_CREATOR: {
    number: 1510,
    message: `Assetholding of creator account cannot be closed to another account`,
    title: "Cannot close asset ID in allocating account",
    description: "Asset holding of Asset creator cannot be closed to other account"
  }
};

export const RUNTIME_ERRORS: {
  [category in keyof typeof RUNTIME_ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  GENERAL: runtimeGeneralErrors,
  TEAL: tealErrors,
  TRANSACTION: transactionErrors,
  ASA: runtimeAsaErrors
};
