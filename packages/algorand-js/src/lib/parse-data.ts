import * as base32 from "hi-base32";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { assertBase32, assertBase64 } from "../lib/helpers";
import { EncodingType } from "../types";

// parse string to Uint8Array
export function toBytes (s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s));
}

// parse Uint8Array to string
export function convertToString (u: Uint8Array): string {
  return Buffer.from(u).toString('utf-8');
}

/**
 * Description : converts string into buffer as per encoding type
 * @param s : string to be converted
 * @param encoding : encoding type
 */
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
    case EncodingType.UTF8: {
      return Buffer.from(s);
    }
    default: { // default encoding (utf-8)
      return Buffer.from(s);
    }
  }
}

/**
 * Description: Returns base64 or base32 string
 * @param args words list
 * @param line line number
 */
function base64OrBase32 (args: string[], line: number): [string, EncodingType] {
  // Base64 string
  if ((args[0].startsWith('base64(') || args[0].startsWith('b64(')) && args[0].endsWith(')')) {
    const str = args[0].startsWith('b64(') ? args[0].slice(4, args[0].length - 1) : args[0].slice(7, args[0].length - 1);
    assertBase64(str, line);

    return [str, EncodingType.BASE64];
  }

  // Base32 string
  if ((args[0].startsWith('base32(') || args[0].startsWith('b32(')) && args[0].endsWith(')')) {
    const str = args[0].startsWith('b32(') ? args[0].slice(4, args[0].length - 1) : args[0].slice(7, args[0].length - 1);
    assertBase32(str, line);

    return [str, EncodingType.BASE32];
  }
  throw new TealError(ERRORS.TEAL.DECODE_ERROR, { val: args[0], line: line });
}

/**
 * Description: returns encodingtype and string from words list
 * @param args : words list for base64 and base32
 */
export function getEncoding (args: string[], line: number): [string, EncodingType] {
  if (args.length === 1) {
    // "string literal"
    if (args[0].startsWith('"') && args[0].endsWith('"')) {
      return [args[0].slice(1, args[0].length - 1), EncodingType.UTF8];
    }

    // 0X.. HEX
    if (args[0].startsWith('0x')) {
      return [args[0].slice(2), EncodingType.HEX];
    }

    return base64OrBase32(args, line);
  } else if (args.length === 2) {
    // base64 string
    if (["base64", "b64"].includes(args[0])) {
      assertBase64(args[1], line);
      return [args[1], EncodingType.BASE64];
    }

    // base32 string
    if (["base32", "b32"].includes(args[0])) {
      assertBase32(args[1], line);
      return [args[1], EncodingType.BASE32];
    }
    throw new TealError(ERRORS.TEAL.UNKOWN_DECODE_TYPE, { val: args[0], line: line });
  } else {
    throw new TealError(ERRORS.TEAL.UNKOWN_DECODE_TYPE, { val: args[0], line: line });
  }
}
