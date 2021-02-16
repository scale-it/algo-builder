import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";

/**
 * Description: compare two array: returns true if they are equal, else false.
 * @param a unknown (array)
 * @param b unknown (array)
 */
export function compareArray (a: unknown, b: unknown): boolean {
  if ((Array.isArray(a) && Array.isArray(b))) {
    return a.length === b.length &&
      a.every((v, i) => v === b[i]);
  }

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return a.length === b.length &&
      a.every((v, i) => v === b[i]);
  }
  return false;
}

/**
 * check if index is accessible in an array
 * @param idx Index
 * @param arr given array
 * @param line line number in TEAL file
 * Note: if user is accessing this function directly through runtime,
 * the line number is unknown
 */
export function checkIndexBound (idx: number, arr: any[], line?: number): void {
  const lineNumber = line ?? 'unknown';
  if (!(idx >= 0 && idx < arr.length)) {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND, { line: lineNumber });
  }
}
