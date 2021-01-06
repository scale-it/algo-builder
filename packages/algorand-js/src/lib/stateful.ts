import { SSCSchemaConfig, SSCStateSchema } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { StackElem } from "../types";
import { base64ToBytes } from "./parsing";

// returns new key value pair by setting type and corresponding values
export function getKeyValPair (key: Uint8Array, value: StackElem): SSCStateSchema {
  let val;
  if (typeof value !== "bigint") {
    val = { type: 1, bytes: value, uint: 0 };
  } else {
    val = { type: 2, bytes: base64ToBytes(''), uint: Number(value) };
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
    k.value.type === 1 ? byteSlices++ : numUint++;
  }
  if (numUint > schema["num-uint"] || byteSlices > schema["num-byte-slice"]) {
    throw new TealError(ERRORS.TEAL.INVALID_SCHEMA);
  }
}
