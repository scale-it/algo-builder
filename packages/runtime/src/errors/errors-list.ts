
export const ERROR_PREFIX = "TEAL_ERR";

export interface ErrorDescriptor {
  number: number
  message: string
  title: string
  description: string
}

export function getErrorCode (error: ErrorDescriptor): string {
  return `${ERROR_PREFIX}${error.number}`;
}

export const ERROR_RANGES = {
  TEAL: { min: 0, max: 99, title: "TEAL opcode errors" }
};

const PARSE_ERROR = "Parse Error";

const tealErrors = {
  ASSERT_STACK_LENGTH: {
    number: 1,
    message: "Length of stack is less than min length required for current op at %line%",
    title: "Length of stack is less than min length required for current op at %line%",
    description: `You are trying to perform an operation on stack where the stack does not
have sufficient length.`
  },
  ASSERT_ARR_LENGTH: {
    number: 2,
    message: "Length of block exceeded 256 or is equal to 0 at %line%",
    title: "Invalid Block length at %line%",
    description: `The size of provided block of []bytes/uint64 is not within the
permissible range of 1 to 256`
  },
  INVALID_OP_ARG: {
    number: 3,
    message: "Error encountered while executing teal with opcode %opcode% , Line : %line% ",
    title: "Invalid Operation",
    description: `Error encountered in stack while executing teal opcode %opcode%`
  },
  INVALID_TYPE: {
    number: 4,
    message: "Error encountered while executing teal code at %line%",
    title: "Invalid type at %line%",
    description: `Error encountered while executing teal code. Type of data is
incorrect. Expected %expected% but got %actual% at %line%`
  },
  UINT64_OVERFLOW: {
    number: 5,
    message: "Result of current operation caused integer overflow at %line%",
    title: "Uint64 Overflow at %line%",
    description: `You are tying to perform operation where the result has exceeded
maximun uint64 value of 18446744073709551615`
  },
  UINT64_UNDERFLOW: {
    number: 6,
    message: "Result of current operation caused integer underflow at %line%",
    title: "Uint64 Underflow at %line%",
    description: `You are tying to perform operation where the result is less than
minimum uint64 value of 0`
  },
  ZERO_DIV: {
    number: 7,
    message: "Runtime Error - Division by zero at %line%",
    title: "Division by zero at %line%",
    description: `Runtime error occured. Cannot divide by zero`
  },
  REJECTED_BY_LOGIC: {
    number: 8,
    message: "Teal code rejected by logic",
    title: "Teal Rejection Error",
    description: `Teal code rejected because stack doesn't contain a single non-zero uint64 value`
  },
  INDEX_OUT_OF_BOUND: {
    number: 9,
    message: "Index out of bound at %line%",
    title: "Index out of bound at %line%",
    description: `Segmentation fault - The teal code tried to access a value
by an index that does not exist.`
  },
  TEAL_ENCOUNTERED_ERR: {
    number: 10,
    message: "TEAL runtime encountered err opcode at %line%",
    title: "TEAL runtime encountered err opcode at %line%",
    description: `TEAL encountered err opcode while executing TEAL code`
  },
  CONCAT_ERROR: {
    number: 11,
    message: "concat resulted in string too long at %line%",
    title: "concat resulted in string too long at %line%",
    description: `concat panics if the result would be greater than 4096 bytes.`
  },
  LONG_INPUT_ERROR: {
    number: 12,
    message: "Input is longer than 8 bytes at %line%",
    title: "Input is longer than 8 bytes at %line%",
    description: `Input is longer than 8 bytes.`
  },
  SUBSTRING_END_BEFORE_START: {
    number: 13,
    message: "substring end before start at %line%",
    title: "substring end before start at %line%",
    description: `substring end before start.`
  },
  SUBSTRING_RANGE_BEYOND: {
    number: 14,
    message: "substring range beyond length of string at %line%",
    title: "substring range beyond length of string at %line%",
    description: `substring range beyond length of string.`
  },
  INVALID_UINT8: {
    number: 15,
    message: "Input is not uint8 at %line%",
    title: "Input is outside the valid uint8 range of 0 to 255 at %line%",
    description: `Input is outside the valid uint8 range of 0 to 255`
  },
  ASSERT_LENGTH: {
    number: 16,
    message: "Invalid Field Length Expected: '%exp%' Got: '%got%', Line : %line% ",
    title: PARSE_ERROR,
    description: `Expected: '%exp%' Got: '%got%`
  },
  INVALID_ADDR: {
    number: 17,
    message: "Invalid Address '%addr%', Line: %line%",
    title: PARSE_ERROR,
    description: `Invalid Address '%addr%`
  },
  PRAGMA_VERSION_ERROR: {
    number: 18,
    message: "Pragma version Error - Expected: version, got: %got%, Line: %line%",
    title: PARSE_ERROR,
    description: ``
  },
  INVALID_BASE64: {
    number: 19,
    message: "Invalid Base64 Error - value %val% is not base64, Line: %line%",
    title: PARSE_ERROR,
    description: `value %exp% is not base64`
  },
  INVALID_BASE32: {
    number: 20,
    message: "Invalid Base32 Error - value %val% is not base32, Line: %line%",
    title: PARSE_ERROR,
    description: `value %exp% is not base32`
  },
  DECODE_ERROR: {
    number: 21,
    message: "Invalid Decode Data - value %val% is invalid, Line: %line%",
    title: "Decode Error",
    description: `value %exp%`
  },
  UNKOWN_DECODE_TYPE: {
    number: 22,
    message: "Invalid Decode Type - value %val% is unknown, Line: %line%",
    title: "Unkown Decode Type",
    description: `value %exp% is unknown`
  },
  INVALID_SCHEMA: {
    number: 23,
    message: "State Schema is invalid",
    title: "TEAL operations resulted in invalid schema",
    description: `TEAL operations resulted in invalid schema`
  },
  APP_NOT_FOUND: {
    number: 24,
    message: "Application Index %appId% not found or is invalid at line %line%",
    title: "Application index %appId% is not found at %line%",
    description: `Application index %appId% is not found`
  },
  LABEL_NOT_FOUND: {
    number: 25,
    message: "Label not found at %line%",
    title: "Label %label% not found at %line%",
    description: `Label %label% not found`
  },
  INVALID_LABEL: {
    number: 26,
    message: "Invalid Label Name at %line%",
    title: "OpCode name cannot be used as label name at line %line%",
    description: `OpCode name cannot be used as label name`
  },
  ACCOUNT_DOES_NOT_EXIST: {
    number: 27,
    message: "Account Error - Account %address% doesn't exist at line %line%",
    title: "Account Error at %line%",
    description: `Account does not exist in the current state`
  },
  UNKNOWN_TRANSACTION_FIELD: {
    number: 28,
    message: "Transaction Field Error - Unknown transaction field \"%field%\" for teal version #%version% at line %line%",
    title: "Transaction Field Error at %line%",
    description: `Transaction Field unknown`
  },
  UNKNOWN_GLOBAL_FIELD: {
    number: 29,
    message: "Global Field Error - Unknown Global field \"%field%\" for teal version #%version% at line %line%",
    title: "Global Field Error at %line%",
    description: `Global Field unknown`
  },
  UNKNOWN_ASSET_FIELD: {
    number: 30,
    message: "Asset Field Error - Unknown Field:  %field% at line %line%",
    title: "Asset Field Error at %line%",
    description: `Asset field unknown`
  },
  UNKNOWN_OPCODE: {
    number: 31,
    message: "Error encountered while parsing teal file: unknown opcode \"%opcode%\" for teal version #%version%, Line: %line% ",
    title: PARSE_ERROR,
    description: `Unknown Opcode encountered`
  },
  INVALID_SECRET_KEY: {
    number: 32,
    message: "invalid secret key: %secretkey%",
    title: "secret key error",
    description: `secret key error`
  },
  INSUFFICIENT_ACCOUNT_BALANCE: {
    number: 33,
    message: "Cannot withdraw %amount% microalgos from account %address%: resulting balance would be insufficient",
    title: 'Insufficient account balance',
    description: `Withdrawing %amount% microalgos will lead to insufficient balance`
  },
  MAX_COST_EXCEEDED: {
    number: 34,
    message: "Cost of provided TEAL code = %cost% exceeds max cost of %maxcost%, Mode: %mode%",
    title: 'MaxCost Error',
    description: `MaxCost Error`
  },
  MAX_LEN_EXCEEDED: {
    number: 35,
    message: "Length of provided TEAL code = %length% exceeds max length of %maxlen%, Mode: %mode%",
    title: 'MaxLength Error',
    description: `MaxLength Error`
  },
  LOGIC_SIGNATURE_NOT_FOUND: {
    number: 35,
    message: "logic signature not found",
    title: "lsig error",
    description: `lsig error`
  },
  LOGIC_SIGNATURE_VALIDATION_FAILED: {
    number: 36,
    message: "logic signature validation failed. address: %address%",
    title: "lsig validation error",
    description: `lsig validation error`
  },
  INVALID_TRANSACTION_PARAMS: {
    number: 27,
    message: "Secret key and Logic Signature should not be passed together",
    title: "Transaction params error",
    description: `Transaction params error`
  }
};

export const ERRORS: {
  [category in keyof typeof ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  TEAL: tealErrors
};
