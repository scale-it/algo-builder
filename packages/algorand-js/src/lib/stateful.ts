import { SSCSchemaConfig, SSCStateSchema } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { StackElem } from "../types";
import { SSC_BYTES, SSC_UINT } from "./constants";
import { stringToBytes } from "./parsing";

// returns new key value pair by setting type and corresponding values
export function getKeyValPair (key: Uint8Array, value: StackElem): SSCStateSchema {
  let val;
  if (typeof value !== "bigint") {
    val = { type: SSC_BYTES, bytes: value, uint: 0 };
  } else {
    val = { type: SSC_UINT, bytes: stringToBytes(''), uint: Number(value) };
  }

  return {
    key: key,
    value: val
  };
}

/**
 * Description: assert if the given key-value pairs are valid by schema
 * @param keyValue: list of key-value pairs (state data)
 * @param schema: permissible local/global state schema
 */
export function assertValidSchema (keyValue: SSCStateSchema[], schema: SSCSchemaConfig): void {
  let numUint = 0; let byteSlices = 0;
  for (const k of keyValue) {
    k.value.type === SSC_BYTES ? byteSlices++ : numUint++;
  }
  if (numUint > schema["num-uint"] || byteSlices > schema["num-byte-slice"]) {
    throw new TealError(ERRORS.TEAL.INVALID_SCHEMA);
  }
}
