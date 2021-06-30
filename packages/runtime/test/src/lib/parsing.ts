import { parsing } from "@algo-builder/web";
import { decodeAddress } from "algosdk";
import { assert } from "chai";

import { MAX_UINT64, MIN_UINT64 } from "../../../src/lib/constants";
import { convertToString } from "../../../src/lib/parsing";

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

describe("Parse appArgs to SSC to bytes", () => {
  it("should return undefined if app Args are not defined", () => {
    const res = parsing.parseAppArgs(undefined);
    assert.isUndefined(res);
  });

  it("should return same bytes if all bytes are passed", () => {
    const res = parsing.parseAppArgs(['a', 'b', 'c'].map(parsing.stringToBytes));
    const expected = [[97], [98], [99]].map(z => new Uint8Array(z));
    assert.deepEqual(res, expected);
  });

  it("should return correct bytes if args are passed similar to goal", () => {
    let res = parsing.parseAppArgs(['int:700000000', 'int:3', `int:${MAX_UINT64}`]);
    let expected = [
      [0, 0, 0, 0, 41, 185, 39, 0],
      [0, 0, 0, 0, 0, 0, 0, 3],
      [255, 255, 255, 255, 255, 255, 255, 255]
    ].map(z => new Uint8Array(z));
    assert.deepEqual(res, expected);

    res = parsing.parseAppArgs(['str:hello', 'str:world']);
    expected = [
      [104, 101, 108, 108, 111], // 'hello'
      [119, 111, 114, 108, 100] // 'world'
    ].map(z => new Uint8Array(z));
    assert.deepEqual(res, expected);

    const elon = 'WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY';
    const john = '2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA';
    res = parsing.parseAppArgs([`addr:${elon}`, `addr:${john}`]);
    expected = [elon, john].map(s => decodeAddress(s).publicKey);
    assert.deepEqual(res, expected);

    res = parsing.parseAppArgs(['b64:a2F0cmluYQ==', 'b64:YmVubmV0']);
    expected = [
      'katrina', // 'katrina' encoded as b64 is a2F0cmluYQ==
      'bennet' // 'bennet' encoded as b64 is YmVubmV0
    ].map(z => parsing.stringToBytes(z));
    assert.deepEqual(res, expected);
  });

  it("should throw error if passed args are invalid", () => {
    const errMsg = (str: string): string => { return `Format of arguments passed to stateful smart is invalid for ${str}`; };

    assert.throws(() => parsing.parseAppArgs(['INT:12']), errMsg('INT:12'));
    assert.throws(() => parsing.parseAppArgs(['intt:1']), errMsg('intt:1'));
    assert.throws(() => parsing.parseAppArgs(['int:abcd']), errMsg('int:abcd')); // type is correct but value is string
    assert.throws(() => parsing.parseAppArgs(['string:hello']), errMsg('string:hello'));
    assert.throws(() => parsing.parseAppArgs(['address:ABCD']), errMsg('address:ABCD'));
    assert.throws(() => parsing.parseAppArgs(['base64:===']), errMsg('base64:==='));
    assert.throws(() => parsing.parseAppArgs(['STR:abc']), errMsg('STR:abc'));
    assert.throws(() => parsing.parseAppArgs(['ADRR:XYZ']), errMsg('ADRR:XYZ'));

    const errorMsg = 'Invalid uint64 18446744073709551625';
    assert.throws(() => parsing.parseAppArgs([`int:${MAX_UINT64 + 10n}`]), errorMsg);
  });
});
