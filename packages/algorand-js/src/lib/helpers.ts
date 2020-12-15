import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { reBase32, reBase64, reDigit } from "./constants";

/**
 * Description: Compare Uint8Arrays
 * @param a Uint8Array
 * @param b Uint8Array
 */
export function compareArray (a: Uint8Array, b: Uint8Array): Boolean {
  return a.length === b.length &&
    a.every((v, i) => v === b[i]);
}

/**
 * Description: assert if string contains digits only
 * "123" // ok.  "12+2" // error.
 * @param val : string
 */
export function assertOnlyDigits (val: string): void {
  if (!reDigit.test(val)) {
    throw new TealError(ERRORS.TEAL.INVALID_TYPE, { expected: "unsigned integer", actual: val });
  }
}

/**
 * Description: assert words length
 * @param val Comparsion result
 * @param expected expected result
 * @param line Line number in TEAL file
 */
export function assertLen (val: number, expected: number, line: number): void {
  if (val !== expected) {
    throw new TealError(ERRORS.TEAL.ASSERT_LENGTH, { exp: expected, got: val, line: line });
  }
}

/**
 * Description: Checks if string is base64
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase64 (str: string, line: number): void {
  if (!reBase64.test(str)) {
    throw new TealError(ERRORS.TEAL.INVALID_BASE64, { val: str, line: line });
  }
}

/**
 * Description: Checks if string is base32
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase32 (str: string, line: number): void {
  if (!reBase32.test(str)) {
    throw new TealError(ERRORS.TEAL.INVALID_BASE32, { val: str, line: line });
  }
}
