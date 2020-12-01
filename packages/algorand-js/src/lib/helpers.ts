export function compareArray (a: Uint8Array, b: Uint8Array): Boolean {
  return a.length === b.length &&
    a.every((v, i) => v === b[i]);
}
