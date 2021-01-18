import * as base32 from "hi-base32";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { EncodingType } from "../types";
import { reBase32, reBase64, reDigit } from "./constants";

/**
 * assert if string contains digits only
 * "123" // ok.  "12+2" // error.
 * @param val : string
 */
export function assertOnlyDigits (val: string, line: number): void {
  if (!reDigit.test(val)) {
    throw new TealError(ERRORS.TEAL.INVALID_TYPE, {
      expected: "unsigned integer (upto 64 bit)",
      actual: val,
      line: line
    });
  }
}

/**
 * assert that a line has given number of words
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
 * Checks if string is base64
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase64 (str: string, line: number): void {
  if (!reBase64.test(str)) {
    throw new TealError(ERRORS.TEAL.INVALID_BASE64, { val: str, line: line });
  }
}

/**
 * Checks if string is base32
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase32 (str: string, line: number): void {
  if (!reBase32.test(str)) {
    throw new TealError(ERRORS.TEAL.INVALID_BASE32, { val: str, line: line });
  }
}

/**
 * returns key as bytes
 * @param key : key in a stateful key-value pair
 */
export function keyToBytes (key: Uint8Array | string): Uint8Array {
  return typeof key === 'string' ? stringToBytes(key) : key;
}

// parse string to Uint8Array
export function stringToBytes (s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s));
}

// parse Uint8Array to string
export function convertToString (u: Uint8Array | Buffer): string {
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
 * Returns string and type of encoding (base64 or base32) on string
 * @param arg string containg type of encoding + encoded string
 * eg. b32(MFRGGZDFMY=) => returns [MFRGGZDFMY=, EncodingType.BASE32]
 * @param line line number
 */
function base64OrBase32 (arg: string, line: number): [string, EncodingType] {
  // Base64 string
  if ((arg.startsWith('base64(') || arg.startsWith('b64(')) && arg.endsWith(')')) {
    const str = arg.startsWith('b64(') ? arg.slice(4, arg.length - 1) : arg.slice(7, arg.length - 1);
    assertBase64(str, line);

    return [str, EncodingType.BASE64];
  }

  // Base32 string
  if ((arg.startsWith('base32(') || arg.startsWith('b32(')) && arg.endsWith(')')) {
    const str = arg.startsWith('b32(') ? arg.slice(4, arg.length - 1) : arg.slice(7, arg.length - 1);
    assertBase32(str, line);

    return [str, EncodingType.BASE32];
  }
  throw new TealError(ERRORS.TEAL.DECODE_ERROR, { val: arg, line: line });
}

/**
 * returns encodingtype (base32, base64, utf8, hex) and the encoded string from words list
 * eg. base64 "dfc/==" => returns [dfc/==, EncodingType.BASE64]
 *     0xadkjka => returns [adkjka, EncodingType.HEX] (removing 0x)
 *     "hello" => returns [hello, EncodingType.UTF8] (removing quotes "")
 * @param args : words list for base64 and base32
 * @param line line number
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

    return base64OrBase32(args[0], line);
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
