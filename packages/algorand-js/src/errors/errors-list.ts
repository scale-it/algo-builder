
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
    message: "Error encountered while executing teal with opcode %opcode%",
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
  }
};

export const ERRORS: {
  [category in keyof typeof ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  TEAL: tealErrors
};
