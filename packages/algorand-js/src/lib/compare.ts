/**
 * Description: compare two array: returns true if they are equal, else false.
 * @param a unkown (array)
 * @param b unkown (array)
 */
export function compareArray (a: unknown, b: unknown): Boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length &&
      a.every((v, i) => v === b[i]);
  }
  return false;
}
