// parse string to Uint8Array
export function toBytes (s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s));
}

// parse Uint8Array to string
export function toString (u: Uint8Array): string {
  return Buffer.from(u).toString('utf-8');
}
