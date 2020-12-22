
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
    message: "Length of stack is less than min length required for current op",
    title: "Length of stack is less than min length required for current op",
    description: `You are trying to perform an operation on stack where the stack does not
have sufficient length.`
  },
  ASSERT_ARR_LENGTH: {
    number: 2,
    message: "Length of block exceeded 256 or is equal to 0",
    title: "Invalid Block length",
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
    message: "Error encountered while executing teal code",
    title: "Invalid type",
    description: `Error encountered while executing teal code. Type of data is
incorrect. Expected %expected% but got %actual%`
  },
  UINT64_OVERFLOW: {
    number: 5,
    message: "Result of current operation caused integer overflow",
    title: "Uint64 Overflow",
    description: `You are tying to perform operation where the result has exceeded
maximun uint64 value of 18446744073709551615`
  },
  UINT64_UNDERFLOW: {
    number: 6,
    message: "Result of current operation caused integer underflow",
    title: "Uint64 Underflow",
    description: `You are tying to perform operation where the result is less than
minimum uint64 value of 0`
  },
  ZERO_DIV: {
    number: 7,
    message: "Runtime Error - Division by zero",
    title: "Division by zero",
    description: `Runtime error occured. Cannot divide by zero`
  },
  LOGIC_REJECTION: {
    number: 8,
    message: "Invalid top of stack",
    title: "Teal Rejection Error",
    description: `Teal code was rejected because top of stack contains
non zero value or []byte`
  },
  INDEX_OUT_OF_BOUND: {
    number: 9,
    message: "Index out of bound",
    title: "Index out of bound",
    description: `Segmentation fault - The teal code tried to access a value
by an index that does not exist.`
  },
  TEAL_ENCOUNTERED_ERR: {
    number: 10,
    message: "TEAL runtime encountered err opcode",
    title: "TEAL runtime encountered err opcode",
    description: `TEAL encountered err opcode while executing TEAL code`
  },
  CONCAT_ERROR: {
    number: 11,
    message: "concat resulted in string too long",
    title: "concat resulted in string too long",
    description: `concat panics if the result would be greater than 4096 bytes.`
  },
  LONG_INPUT_ERROR: {
    number: 12,
    message: "Input is longer than 8 bytes",
    title: "Input is longer than 8 bytes",
    description: `Input is longer than 8 bytes.`
  },
  SUBSTRING_END_BEFORE_START: {
    number: 13,
    message: "substring end before start",
    title: "substring end before start",
    description: `substring end before start.`
  },
  SUBSTRING_RANGE_BEYOND: {
    number: 14,
    message: "substring range beyond length of string",
    title: "substring range beyond length of string",
    description: `substring range beyond length of string.`
  },
  INVALID_UINT8: {
    number: 15,
    message: "Input is not uint8",
    title: "Input is outside the valid uint8 range of 0 to 255",
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
    message: "Application Id is not found or is invalid",
    title: "Application id %appId% is not found",
    description: `Application id %appId% is not found`
  },
  LABEL_NOT_FOUND: {
    number: 25,
    message: "Label not found",
    title: "Label %label% not found",
    description: `Label %label% not found`
  },
  INVALID_STACK_ELEM: {
    number: 26,
    message: "Invalid top of stack or length of stack > 1",
    title: "Invalid top of stack or length of stack > 1",
    description: `Either Length of stack is > 1 or top of stack is not uint64`
  },
  INVALID_LABEL: {
    number: 25,
    message: "Invalid Label Name",
    title: "OpCode name cannot be used as label name",
    description: `OpCode name cannot be used as label name`
  },
  ACCOUNT_DOES_NOT_EXIST: {
    number: 27,
    message: "Account Error - Account doesn't exist",
    title: "Account Error",
    description: `Account does not exist in the current state`
  },
  UNKOWN_TRANSACTION_FIELD: {
    number: 28,
    message: "Transaction Field Error - Unknown transaction field %field%",
    title: "Transaction Field Error",
    description: `Transaction Field unkown`
  },
  UNKOWN_GLOBAL_FIELD: {
    number: 29,
    message: "Global Field Error - Unknown Global field %field%",
    title: "Global Field Error",
    description: `Global Field unkown`
  },
  UNKNOWN_ASSET_FIELD: {
    number: 30,
    message: "Asset Field Error - Field unknown %field%",
    title: "Asset Field Error",
    description: `Asset field unkown`
  }
};

export const ERRORS: {
  [category in keyof typeof ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  TEAL: tealErrors
};
