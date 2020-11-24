
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
  INVALID_OP_ARG: {
    number: 2,
    message: "Error encountered while executing teal with opcode %opcode%",
    title: "Invalid Operation",
    description: `Error encountered in stack while executing teal opcode %opcode%`
  },
  INVALID_TYPE: {
    number: 3,
    message: "Error encountered while executing teal code",
    title: "Invalid type",
    description: `Error encountered while executing teal code. Type of data is
incorrect. Expected %expected% but got %actual%`
  },
  UINT64_OVERFLOW: {
    number: 4,
    message: "Result of current operation caused integer overflow",
    title: "Uint64 Overflow",
    description: `You are tying to perform operation where the result has exceeded 
maximun uint64 value of 18446744073709551615`
  },
  UINT64_UNDERFLOW: {
    number: 5,
    message: "Result of current operation caused integer underflow",
    title: "Uint64 Underflow",
    description: `You are tying to perform operation where the result is less than 
minimum uint64 value of 0`
  },
  ZERO_DIV: {
    number: 6,
    message: "Runtime Error - Division by zero",
    title: "Division by zero",
    description: `Runtime error occured. Cannot divide by zero`
  },
  TEAL_REJECTION_ERROR: {
    number: 7,
    message: "Invalid top of stack",
    title: "Teal Rejection Error",
    description: `Teal code was rejected because top of stack contains
non zero value or []byte`
  }
};

export const ERRORS: {
  [category in keyof typeof ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  TEAL: tealErrors
};
