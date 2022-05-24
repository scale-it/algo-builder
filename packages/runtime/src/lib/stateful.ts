import { modelsv2 } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { StackElem } from "../types";
import { MAX_KEY_BYTES, MAX_KEY_VAL_BYTES } from "./constants";

/**
 * Allow the combination of key-value pairs to a max size of 128 bytes.
 * i.e (key.length + value.length <= 128)
 * NOTE: The key is still restricted to 64 bytes or less.
 * @param key stateful schema key
 * @param value value at key (uint / bytes)
 * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
 */
function assertKeyValLengthValid(key: Uint8Array, value: StackElem): void {
	let isSchemaInValid = false;
	isSchemaInValid = key.length > MAX_KEY_BYTES;
	if (value instanceof Uint8Array && key.length + value.length > MAX_KEY_VAL_BYTES) {
		isSchemaInValid = true;
	}

	if (isSchemaInValid) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_SCHEMA);
	}
}

/**
 * Description: assert if the given key-value pairs are valid by schema
 * @param keyValue: list of key-value pairs (state data)
 * @param schema: permissible local/global state schema
 */
export function assertValidSchema(
	keyValue: Map<string, StackElem>,
	schema: modelsv2.ApplicationStateSchema
): void {
	let numUint = 0;
	let byteSlices = 0;
	keyValue.forEach((value, key) => {
		const keyasByte = new Uint8Array(key.split(",").map(Number));
		assertKeyValLengthValid(keyasByte, value);
		value instanceof Uint8Array ? byteSlices++ : numUint++;
	});
	if (numUint > schema.numUint || byteSlices > schema.numByteSlice) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_SCHEMA);
	}
}
