import * as base32 from "hi-base32";

import { EncodingType } from "../types";

// parse string to Uint8Array
export function toBytes (s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s));
}

// parse Uint8Array to string
export function convertToString (u: Uint8Array): string {
  return Buffer.from(u).toString('utf-8');
}

export function convertToBuffer (s: string, encoding?: EncodingType): Buffer {
  switch (encoding) {
    case EncodingType.BASE64: {
      return Buffer.from(s, 'base64');
    }
    case EncodingType.BASE32: {
      return Buffer.from(base32.decode(s));
    }
    case EncodingType.HEX: {
      return Buffer.from(s, 'hex');
    }
    default: { // default encoding (utf-8)
      return Buffer.from(s);
    }
  }
}
