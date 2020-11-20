
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
  UINT64_OVERFLOW: {
    number: 3,
    message: "Result of current operation caused integer overflow",
    title: "Uint64 Overflow",
    description: `You are tying to perform operation where the result has exceeded 
maximun uint64 value of 18446744073709551615`
  },
  UINT64_UNDERFLOW: {
    number: 4,
    message: "Result of current operation caused integer underflow",
    title: "Uint64 Underflow",
    description: `You are tying to perform operation where the result is less than 
minimum uint64 value of 0`
  }
};

export const ERRORS: {
  [category in keyof typeof ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  TEAL: tealErrors
};
