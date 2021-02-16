import { SSCSchemaConfig } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { StackElem } from "../types";

/**
 * Description: assert if the given key-value pairs are valid by schema
 * @param keyValue: list of key-value pairs (state data)
 * @param schema: permissible local/global state schema
 */
export function assertValidSchema (keyValue: Map<string, StackElem>, schema: SSCSchemaConfig): void {
  let numUint = 0; let byteSlices = 0;
  keyValue.forEach((value, key) => {
    value instanceof Uint8Array ? byteSlices++ : numUint++;
  });
  if (numUint > schema["num-uint"] || byteSlices > schema["num-byte-slice"]) {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_SCHEMA);
  }
}
