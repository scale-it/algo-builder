import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";

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
  if (!(/^\d+$/.test(val))) {
    throw new TealError(ERRORS.TEAL.PARSE_ERROR);
  }
}

/**
 * Description: assert fields length
 * @param val Comparsion result
 * @param expected expected result
 */
export function assertFieldLen (val: number, expected: number): void {
  if (val !== expected) {
    throw new TealError(ERRORS.TEAL.ASSERT_FIELD_LENGTH);
  }
}
