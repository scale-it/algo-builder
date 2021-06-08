import { decodeAddress } from "algosdk";
import * as base32 from "hi-base32";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { EncodingType } from "../types";
import { MAX_UINT64, MIN_UINT64, reBase32, reBase64, reDigit } from "./constants";

/**
 * assert if string contains digits only
 * "123" // ok.  "12+2" // error.
 * @param val : string
 */
export function assertOnlyDigits (val: string, line: number): void {
  if (!reDigit.test(val)) {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, {
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
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.ASSERT_LENGTH, { exp: expected, got: val, line: line });
  }
}

/**
 * Checks if string is base64
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase64 (str: string, line: number): void {
  if (!reBase64.test(str)) {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_BASE64, { val: str, line: line });
  }
}

/**
 * Checks if string is base32
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase32 (str: string, line: number): void {
  if (!reBase32.test(str)) {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_BASE32, { val: str, line: line });
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

// verify n is an unsigned 64 bit integer
function assertUint64 (n: bigint): void {
  if (n < MIN_UINT64 || n > MAX_UINT64) {
    throw new Error(`Invalid uint64 ${n}`);
  }
}

/**
 * Converts 64 bit unsigned integer to bytes in big endian.
 */
export function uint64ToBigEndian (x: number | bigint): Uint8Array {
  x = BigInt(x); // use x as bigint internally to support upto uint64
  assertUint64(x);
  const buff = Buffer.alloc(8);
  buff.writeBigUInt64BE(x);
  return Uint8Array.from(buff);
}

/**
 * Takes an Algorand address in string form and decodes it into a Uint8Array (as public key)
 * @param addr : algorand address
 */
export function addressToPk (addr: string): Uint8Array {
  return decodeAddress(addr).publicKey;
}

const throwFmtError = (appArg: string): void => {
  throw new Error(`Format of arguments passed to stateful smart is invalid for ${appArg}`);
};

/**
 * Parses appArgs to bytes if arguments passed to SSC are similar to goal ('int:1', 'str:hello'..)
 * https://developer.algorand.org/docs/features/asc1/stateful/#passing-arguments-to-stateful-smart-contracts
 * eg. "int:1" => new Uint8Aarray([0, 0, 0, 0, 0, 0, 0, 1])
 * NOTE: parseSSCAppArgs returns undefined to handle the case when application args passed to
 * stateful smart contract is undefined
 * @param appArgs : arguments to stateful smart contract
 */
export function parseSSCAppArgs (appArgs?: Array<Uint8Array | string>): Uint8Array[] | undefined {
  if (appArgs === undefined) { return undefined; }
  const args = [];

  for (const appArg of appArgs) {
    // if appArg already bytes, then we don't need to parse
    // just push to array and continue
    if (appArg instanceof Uint8Array) {
      args.push(appArg);
      continue;
    }
    const [type, value] = appArg.split(':'); // eg "int:1" => ['int', '1']

    // if given string is not invalid, throw error
    if (type === undefined || value === undefined) { throwFmtError(appArg); }

    // parse string to bytes according to type
    let arg;
    switch (type) {
      case 'int': {
        if (!reDigit.test(value)) { throwFmtError(appArg); } // verify only digits are present in string
        arg = uint64ToBigEndian(BigInt(value));
        break;
      }
      case 'str': {
        arg = stringToBytes(value);
        break;
      }
      case 'addr': {
        arg = addressToPk(value);
        break;
      }
      case 'b64': {
        arg = new Uint8Array(Buffer.from(value, 'base64'));
        break;
      }
      default: {
        throwFmtError(appArg);
      }
    }
    args.push(arg);
  };
  return args as Uint8Array[];
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
  throw new RuntimeError(RUNTIME_ERRORS.TEAL.DECODE_ERROR, { val: arg, line: line });
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
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE, { val: args[0], line: line });
  } else {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE, { val: args[0], line: line });
  }
}

/**
 * Parses binary string into bigint. Eg '101' OR ['1', '0', '1'] => 5n
 * @param binary Binary string array or a string
 */
export function parseBinaryStrToBigInt (binary: string[] | string): bigint {
  let res = 0n;
  for (let i = 0; i < binary.length; ++i) {
    if (binary[i] === '1') {
      const val = binary.length - 1 - i;
      res += 2n ** BigInt(val);
    }
  }
  return res;
}
