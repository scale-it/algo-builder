/**
 * Description: Compare Uint8Arrays
 * @param a Uint8Array
 * @param b Uint8Array
 */
export function compareArray (a: Uint8Array | string, b: Uint8Array | string): Boolean {
  if (a.length === b.length) {
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
}
