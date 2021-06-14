import { parseSSCAppArgs, stringToBytes, uint64ToBigEndian } from "@algo-builder/runtime";
import { decodeAddress } from "algosdk";
import { assert } from "chai";

import { MAX_UINT64, MIN_UINT64 } from "../../src/lib/constants";

describe("Convert integer to big endian", () => {
  /**
   * Note: Expected results are derived from following go code
   * v := uint64(number)
   * buf := make([]byte, 8)
   * binary.BigEndian.PutUint64(buf, v)
   * fmt.Println(buf)
   */
  it("should return correct big endian for 64 bit integer", () => {
    let res = uint64ToBigEndian(0);
    let expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(20);
    expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 20]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(700000000);
    expected = new Uint8Array([0, 0, 0, 0, 41, 185, 39, 0]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(233654);
    expected = new Uint8Array([0, 0, 0, 0, 0, 3, 144, 182]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(Number.MAX_SAFE_INTEGER);
    expected = new Uint8Array([0, 31, 255, 255, 255, 255, 255, 255]);
    assert.deepEqual(res, expected);

    // passing bigint in tests below
    res = uint64ToBigEndian(MIN_UINT64);
    expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(233654n);
    expected = new Uint8Array([0, 0, 0, 0, 0, 3, 144, 182]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(18446744073709551055n);
    expected = new Uint8Array([255, 255, 255, 255, 255, 255, 253, 207]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(18446744073709111055n);
    expected = new Uint8Array([255, 255, 255, 255, 255, 249, 71, 15]);
    assert.deepEqual(res, expected);

    res = uint64ToBigEndian(MAX_UINT64);
    expected = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
    assert.deepEqual(res, expected);
  });

  it("should throw error if value is not uint64", () => {
    let errMsg = "Invalid uint64 -5";
    assert.throws(() => uint64ToBigEndian(MIN_UINT64 - 5n), errMsg);

    errMsg = "Invalid uint64 18446744073709551620";
    assert.throws(() => uint64ToBigEndian(MAX_UINT64 + 5n), errMsg);
  });
});

describe("Parse appArgs to SSC to bytes", () => {
  it("should return undefined if app Args are not defined", () => {
    const res = parseSSCAppArgs(undefined);
    assert.isUndefined(res);
  });

  it("should return same bytes if all bytes are passed", () => {
    const res = parseSSCAppArgs(['a', 'b', 'c'].map(stringToBytes));
    const expected = [[97], [98], [99]].map(z => new Uint8Array(z));
    assert.deepEqual(res, expected);
  });

  it("should return correct bytes if args are passed similar to goal", () => {
    let res = parseSSCAppArgs(['int:700000000', 'int:3', `int:${MAX_UINT64}`]);
    let expected = [
      [0, 0, 0, 0, 41, 185, 39, 0],
      [0, 0, 0, 0, 0, 0, 0, 3],
      [255, 255, 255, 255, 255, 255, 255, 255]
    ].map(z => new Uint8Array(z));
    assert.deepEqual(res, expected);

    res = parseSSCAppArgs(['str:hello', 'str:world']);
    expected = [
      [104, 101, 108, 108, 111], // 'hello'
      [119, 111, 114, 108, 100] // 'world'
    ].map(z => new Uint8Array(z));
    assert.deepEqual(res, expected);

    const elon = 'WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY';
    const john = '2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA';
    res = parseSSCAppArgs([`addr:${elon}`, `addr:${john}`]);
    expected = [elon, john].map(s => decodeAddress(s).publicKey);
    assert.deepEqual(res, expected);

    res = parseSSCAppArgs(['b64:a2F0cmluYQ==', 'b64:YmVubmV0']);
    expected = [
      'katrina', // 'katrina' encoded as b64 is a2F0cmluYQ==
      'bennet' // 'bennet' encoded as b64 is YmVubmV0
    ].map(z => stringToBytes(z));
    assert.deepEqual(res, expected);
  });

  it("should throw error if passed args are invalid", () => {
    const errMsg = (str: string): string => { return `Format of arguments passed to stateful smart is invalid for ${str}`; };

    assert.throws(() => parseSSCAppArgs(['INT:12']), errMsg('INT:12'));
    assert.throws(() => parseSSCAppArgs(['intt:1']), errMsg('intt:1'));
    assert.throws(() => parseSSCAppArgs(['int:abcd']), errMsg('int:abcd')); // type is correct but value is string
    assert.throws(() => parseSSCAppArgs(['string:hello']), errMsg('string:hello'));
    assert.throws(() => parseSSCAppArgs(['address:ABCD']), errMsg('address:ABCD'));
    assert.throws(() => parseSSCAppArgs(['base64:===']), errMsg('base64:==='));
    assert.throws(() => parseSSCAppArgs(['STR:abc']), errMsg('STR:abc'));
    assert.throws(() => parseSSCAppArgs(['ADRR:XYZ']), errMsg('ADRR:XYZ'));

    const errorMsg = 'Invalid uint64 18446744073709551625';
    assert.throws(() => parseSSCAppArgs([`int:${MAX_UINT64 + 10n}`]), errorMsg);
  });
});
