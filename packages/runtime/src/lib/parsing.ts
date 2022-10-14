import { parsing } from "@algo-builder/web";
import * as base32 from "hi-base32";
import JSONbig from "json-bigint";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { EncodingType } from "../types";
import { reBase32, reBase64, reBase64Url, reDec, reDigit, reHex, reOct } from "./constants";

/**
 * assert if string contains digits only
 * "123" // ok.  "12+2" // error.
 * @param val : string
 */
export function assertOnlyDigits(val: string, line: number): void {
	if (!reDigit.test(val)) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, {
			expected: "unsigned integer (upto 64 bit)",
			actual: val,
			line: line,
		});
	}
}

/**
 * assert if string is valid algorand number respesentation (octal / hex / unsigned int).
 * return val if format is correct
 * @param val : string
 */
export function assertNumber(val: string, line: number): string {
	if (reOct.test(val)) {
		// typescript use 0o postfix instade of 0 postfix for oct format.
		return "0o".concat(val.substring(1));
	}

	if (reDec.test(val) || reHex.test(val)) return val;

	throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, {
		expected: "unsigned integer (upto 64 bit)",
		actual: val,
		line: line,
	});
}

/**
 * assert that a line has given number of words
 * @param val Comparsion result
 * @param expected expected result
 * @param line Line number in TEAL file
 */
export function assertLen(val: number, expected: number, line: number): void {
	if (val !== expected) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.ASSERT_LENGTH, {
			exp: expected,
			got: val,
			line: line,
		});
	}
}

/**
 * Checks if string is base64
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase64(str: string, line: number): void {
	if (!reBase64.test(str)) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_BASE64, { val: str, line: line });
	}
}

/**
 * Checks if string is base64Url
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase64Url(str: string, line: number): void {
	if (!reBase64Url.test(str)) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_BASE64URL, { val: str, line: line });
	}
}

/**
 * Checks if string is base32
 * @param str : string that needs to be checked
 * @param line : line number in TEAL file
 */
export function assertBase32(str: string, line: number): void {
	if (!reBase32.test(str)) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_BASE32, { val: str, line: line });
	}
}

/**
 * returns key as bytes
 * @param key : key in a stateful key-value pair
 */
export function keyToBytes(key: Uint8Array | string): Uint8Array {
	return typeof key === "string" ? parsing.stringToBytes(key) : key;
}

// parse Uint8Array to string
export function convertToString(u: Uint8Array | Buffer): string {
	return Buffer.from(u).toString("utf-8");
}

/**
 * Description : converts string into buffer as per encoding type
 * @param s : string to be converted
 * @param encoding : encoding type
 */
export function convertToBuffer(s: string, encoding?: EncodingType): Buffer {
	switch (encoding) {
		case EncodingType.BASE64: {
			return Buffer.from(s, "base64");
		}
		case EncodingType.BASE32: {
			return Buffer.from(base32.decode(s));
		}
		case EncodingType.HEX: {
			return Buffer.from(s, "hex");
		}
		case EncodingType.UTF8: {
			return Buffer.from(s);
		}
		default: {
			// default encoding (utf-8)
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
function base64OrBase32(arg: string, line: number): [string, EncodingType] {
	// Base64 string
	if ((arg.startsWith("base64(") || arg.startsWith("b64(")) && arg.endsWith(")")) {
		const str = arg.startsWith("b64(")
			? arg.slice(4, arg.length - 1)
			: arg.slice(7, arg.length - 1);
		assertBase64(str, line);

		return [str, EncodingType.BASE64];
	}

	// Base32 string
	if ((arg.startsWith("base32(") || arg.startsWith("b32(")) && arg.endsWith(")")) {
		const str = arg.startsWith("b32(")
			? arg.slice(4, arg.length - 1)
			: arg.slice(7, arg.length - 1);
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
export function getEncoding(args: string[], line: number): [string, EncodingType] {
	if (args.length === 1) {
		// "string literal"
		if (args[0].startsWith('"') && args[0].endsWith('"')) {
			return [args[0].slice(1, args[0].length - 1), EncodingType.UTF8];
		}

		// 0X.. HEX
		if (args[0].startsWith("0x")) {
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
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE, {
			val: args[0],
			line: line,
		});
	} else {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE, {
			val: args[0],
			line: line,
		});
	}
}

/**
 * Parses binary string into bigint. Eg '101' OR ['1', '0', '1'] => 5n
 * @param binary Binary string array or a string
 */
export function parseBinaryStrToBigInt(binary: string[] | string): bigint {
	let res = 0n;
	for (let i = 0; i < binary.length; ++i) {
		if (binary[i] === "1") {
			const val = binary.length - 1 - i;
			res += 2n ** BigInt(val);
		}
	}
	return res;
}

// convert bigint/number -> hex string
function toHex(b: bigint | number): string {
	const hex = BigInt(b).toString(16);
	if (hex.length % 2) {
		return "0" + hex;
	} // add missing padding
	return hex;
}

// converts buffer/uint8array to hex string
function buffToHex(u: Uint8Array | Buffer): string {
	const uint8Arr = Uint8Array.from(u);
	const hexArr: string[] = [];
	uint8Arr.forEach((i) => {
		hexArr.push(toHex(i));
	}); // each byte to hex
	return "0x" + hexArr.join("");
}

/**
 * Parses bigint to big endian bytes (represeted as Uint8array)
 * NOTE: This is different from decodeUint64, encodeUint64 as it is capable of
 * handling bigint > 64 bit (8 bytes).
 * @param b value in bigint to parse
 */
export function bigintToBigEndianBytes(b: bigint): Uint8Array {
	const hex = toHex(b);

	// The byteLength will be half of the hex string length
	const len = hex.length / 2;
	const u8 = new Uint8Array(len);

	// And then we can iterate each element by one
	// and each hex segment by two
	let i = 0;
	let j = 0;
	while (i < len) {
		u8[i] = parseInt(hex.slice(j, j + 2), 16);
		i += 1;
		j += 2;
	}

	return u8;
}

/**
 * Parses unsigned big endian bytes (represented as Uint8array) back to bigint
 * NOTE: This is different from decodeUint64, encodeUint64 as it is capable of
 * handling bigint > 64 bit (8 bytes).
 * @param bytes big endian bytes (buffer or Uint8array)
 */
export function bigEndianBytesToBigInt(bytes: Uint8Array | Buffer): bigint {
	if (bytes.length === 0) {
		return 0n;
	}
	return BigInt(buffToHex(bytes));
}

/**
 * Parse String hex to bytes(represented as Uint8array)
 * @param str
 */
export function strHexToBytes(str: string): Uint8Array {
	return new Uint8Array(Buffer.from(str.slice(2), "hex"));
}
/*
 * Function taken from algosdk.utils
 * ConcatArrays takes n number arrays and returns a joint Uint8Array
 * @param arrs - An arbitrary number of n array-like number list arguments
 * @returns [a,b]
 */
export function concatArrays(...arrs: ArrayLike<number>[]) {
	const size = arrs.reduce((sum, arr) => sum + arr.length, 0);
	const c = new Uint8Array(size);

	let offset = 0;
	for (let i = 0; i < arrs.length; i++) {
		c.set(arrs[i], offset);
		offset += arrs[i].length;
	}

	return c;
}

/**
 * assert if given string is a valid JSON object
 * @param jsonString
 */
export function assertJSON(jsonString: string, line: number): void {
	const strictBigJSON = JSONbig({ strict: true });
	try {
		strictBigJSON.parse(jsonString);
	} catch (e) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_JSON_PARSING, {
			line: line,
		});
	}
}
