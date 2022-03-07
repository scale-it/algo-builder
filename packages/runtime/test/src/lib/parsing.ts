import { parsing } from "@algo-builder/web";
import { decodeAddress } from "algosdk";
import { assert } from "chai";

import { MAX_UINT64, MIN_UINT64 } from "../../../src/lib/constants";
import {
	bigEndianBytesToBigInt,
	bigintToBigEndianBytes,
	convertToString,
} from "../../../src/lib/parsing";

describe("Convert integer to big endian", () => {
	/**
	 * Note: Expected results are derived from following go code
	 * v := uint64(number)
	 * buf := make([]byte, 8)
	 * binary.BigEndian.PutUint64(buf, v)
	 * fmt.Println(buf)
	 */
	it("should return correct big endian for 64 bit integer", () => {
		let res = parsing.uint64ToBigEndian(0);
		let expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(20);
		expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 20]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(700000000);
		expected = new Uint8Array([0, 0, 0, 0, 41, 185, 39, 0]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(233654);
		expected = new Uint8Array([0, 0, 0, 0, 0, 3, 144, 182]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(Number.MAX_SAFE_INTEGER);
		expected = new Uint8Array([0, 31, 255, 255, 255, 255, 255, 255]);
		assert.deepEqual(res, expected);

		// passing bigint in tests below
		res = parsing.uint64ToBigEndian(MIN_UINT64);
		expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(233654n);
		expected = new Uint8Array([0, 0, 0, 0, 0, 3, 144, 182]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(18446744073709551055n);
		expected = new Uint8Array([255, 255, 255, 255, 255, 255, 253, 207]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(18446744073709111055n);
		expected = new Uint8Array([255, 255, 255, 255, 255, 249, 71, 15]);
		assert.deepEqual(res, expected);

		res = parsing.uint64ToBigEndian(MAX_UINT64);
		expected = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
		assert.deepEqual(res, expected);
	});

	/* eslint-disable max-len */
	it("should return correct big endian bytes from bigint", () => {
		let res = bigintToBigEndianBytes(MIN_UINT64);
		let expected = new Uint8Array([0]); // this is not "strict" uintN byte conversion, so 0 is parsed as new Uint8array([0])
		assert.deepEqual(res, expected);

		res = bigintToBigEndianBytes(MAX_UINT64); // max 8 bytes array
		expected = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
		assert.deepEqual(res, expected);

		// max 16 bytes array
		res = bigintToBigEndianBytes(340282366920938463463374607431768211455n);
		expected = new Uint8Array([
			255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
		]);
		assert.deepEqual(res, expected);

		// max 32 bytes array (i.e 256 bit unsigned integer)
		res =
			bigintToBigEndianBytes(
				115792089237316195423570985008687907853269984665640564039457584007913129639935n
			);
		expected = new Uint8Array(32).fill(255);
		assert.deepEqual(res, expected);

		// max 64 bytes array (i.e 512 bit unsigned integer)
		res =
			bigintToBigEndianBytes(
				13407807929942597099574024998205846127479365820592393377723561443721764030073546976801874298166903427690031858186486050853753882811946569946433649006084095n
			);
		expected = new Uint8Array(64).fill(255);
		assert.deepEqual(res, expected);

		// max 128 bytes array (i.e 1024 bit unsigned integer)
		res =
			bigintToBigEndianBytes(
				179769313486231590772930519078902473361797697894230657273430081157732675805500963132708477322407536021120113879871393357658789768814416622492847430639474124377767893424865485276302219601246094119453082952085005768838150682342462881473913110540827237163350510684586298239947245938479716304835356329624224137215n
			);
		expected = new Uint8Array(128).fill(255);
		assert.deepEqual(res, expected);
	});

	it("should return correct bigint value from big endian bytes", () => {
		let res = bigEndianBytesToBigInt(new Uint8Array([0]));
		let expected = 0n;
		assert.deepEqual(res, expected);

		res = bigEndianBytesToBigInt(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
		expected = 0n;
		assert.deepEqual(res, expected);

		res = bigEndianBytesToBigInt(new Uint8Array(8).fill(255));
		expected = MAX_UINT64;
		assert.deepEqual(res, expected);

		res = bigEndianBytesToBigInt(new Uint8Array(16).fill(255));
		expected = 340282366920938463463374607431768211455n;
		assert.deepEqual(res, expected);

		res = bigEndianBytesToBigInt(new Uint8Array(32).fill(255));
		expected = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
		assert.deepEqual(res, expected);

		res = bigEndianBytesToBigInt(new Uint8Array(64).fill(255));
		expected =
			13407807929942597099574024998205846127479365820592393377723561443721764030073546976801874298166903427690031858186486050853753882811946569946433649006084095n;
		assert.deepEqual(res, expected);
	});

	it("should throw error if value is not uint64", () => {
		let errMsg = "Invalid uint64 -5";
		assert.throws(() => parsing.uint64ToBigEndian(MIN_UINT64 - 5n), errMsg);

		errMsg = "Invalid uint64 18446744073709551620";
		assert.throws(() => parsing.uint64ToBigEndian(MAX_UINT64 + 5n), errMsg);
	});
});

describe("Parse string and integer, with bytes", () => {
	it("string identity should be equal ", () => {
		let initialString = "50";
		let stringInBytes = parsing.stringToBytes(initialString);
		let backToString = convertToString(stringInBytes);

		assert.equal(backToString, initialString);

		initialString = "TEAL_CODE";
		stringInBytes = parsing.stringToBytes(initialString);
		backToString = convertToString(stringInBytes);

		assert.equal(backToString, initialString);
	});
});

describe("Parse appArgs to App to bytes", () => {
	it("should return undefined if app Args are not defined", () => {
		const res = parsing.parseAppArgs(undefined);
		assert.isUndefined(res);
	});

	it("should return same bytes if all bytes are passed", () => {
		const res = parsing.parseAppArgs(["a", "b", "c"].map(parsing.stringToBytes));
		const expected = [[97], [98], [99]].map((z) => new Uint8Array(z));
		assert.deepEqual(res, expected);
	});

	it("should return correct bytes if args are passed similar to goal", () => {
		let res = parsing.parseAppArgs(["int:700000000", "int:3", `int:${MAX_UINT64}`]);
		let expected = [
			[0, 0, 0, 0, 41, 185, 39, 0],
			[0, 0, 0, 0, 0, 0, 0, 3],
			[255, 255, 255, 255, 255, 255, 255, 255],
		].map((z) => new Uint8Array(z));
		assert.deepEqual(res, expected);

		res = parsing.parseAppArgs(["str:hello", "str:world", "str:ipfs://ABCD", "str:"]);
		expected = [
			[104, 101, 108, 108, 111], // 'hello'
			[119, 111, 114, 108, 100], // 'world'
			[105, 112, 102, 115, 58, 47, 47, 65, 66, 67, 68], // 'ipfs://ABCD'
			[], // empty string
		].map((z) => new Uint8Array(z));
		assert.deepEqual(res, expected);

		const elon = "WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY";
		const john = "2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA";
		res = parsing.parseAppArgs([`addr:${elon}`, `addr:${john}`]);
		expected = [elon, john].map((s) => decodeAddress(s).publicKey);
		assert.deepEqual(res, expected);

		res = parsing.parseAppArgs(["b64:a2F0cmluYQ==", "b64:YmVubmV0"]);
		expected = [
			"katrina", // 'katrina' encoded as b64 is a2F0cmluYQ==
			"bennet", // 'bennet' encoded as b64 is YmVubmV0
		].map((z) => parsing.stringToBytes(z));
		assert.deepEqual(res, expected);
	});

	it("should throw error if passed args are invalid", () => {
		const errMsg = (str: string): string => {
			return `Format of arguments passed to stateful smart is invalid for ${str}`;
		};

		assert.throws(() => parsing.parseAppArgs(["INT:12"]), errMsg("INT:12"));
		assert.throws(() => parsing.parseAppArgs(["intt:1"]), errMsg("intt:1"));
		assert.throws(() => parsing.parseAppArgs(["int:abcd"]), errMsg("int:abcd")); // type is correct but value is string
		assert.throws(() => parsing.parseAppArgs(["string:hello"]), errMsg("string:hello"));
		assert.throws(() => parsing.parseAppArgs(["address:ABCD"]), errMsg("address:ABCD"));
		assert.throws(() => parsing.parseAppArgs(["base64:==="]), errMsg("base64:==="));
		assert.throws(() => parsing.parseAppArgs(["STR:abc"]), errMsg("STR:abc"));
		assert.throws(() => parsing.parseAppArgs(["ADRR:XYZ"]), errMsg("ADRR:XYZ"));

		const errorMsg = "Invalid uint64 18446744073709551625";
		assert.throws(() => parsing.parseAppArgs([`int:${MAX_UINT64 + 10n}`]), errorMsg);
	});
});
