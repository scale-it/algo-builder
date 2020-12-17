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
