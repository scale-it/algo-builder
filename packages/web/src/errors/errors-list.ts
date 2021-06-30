
export const ALGOB_WEB_ERROR_PREFIX = "ALGOB_WEB_ERR";

export interface ErrorDescriptor {
  number: number
  message: string
  title: string
  description: string
}

export function getAlgobWebErrorCode (error: ErrorDescriptor): string {
  return `${ALGOB_WEB_ERROR_PREFIX}${error.number}`;
}

export const ALGOB_WEB_ERROR_RANGES = {
  TRANSACTION: { min: 200, max: 399, title: "Transaction error" },
  ASA: { min: 400, max: 599, title: "ASA Error" }
};

export const transactionErrors = {
  TRANSACTION_TYPE_ERROR: {
    number: 200,
    message: "Error. Transaction Type %transaction% is Unknown",
    title: "Unknown Transaction type",
    description: `Provided transaction type is unknown
    Please double check your transaction type`
  }
};

export const asaErrors = {
  PARAM_PARSE_ERROR: {
    number: 400,
    message: `Invalid ASA definition: '%source%'.
    Reason: %reason%`,
    title: "Invalid ASA definition",
    description: `Invalid ASA definition: '%source%'.
    Reason: %reason%
    Please check your ASA file`
  }
};

export const ALGOB_WEB_ERRORS: {
  [category in keyof typeof ALGOB_WEB_ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  TRANSACTION: transactionErrors,
  ASA: asaErrors
};
