import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { getEncoding, parseBinaryStrToBigInt } from "../../../src/lib/parsing";
import { EncodingType } from "../../../src/types";
import { expectRuntimeError } from "../../helpers/runtime-errors";

describe("Get Encoding for Byte Data", () => {
  it("should return corrent Encoding type for string", () => {
    const res = getEncoding(["\"string literal\""], 1);

    assert.deepEqual(res, ["string literal", EncodingType.UTF8]);
  });

  it("should return corrent Encoding type for hex", () => {
    const res = getEncoding(["0xadkjka"], 1);

    assert.deepEqual(res, ["adkjka", EncodingType.HEX]);
  });

  it("should return corrent Encoding type for base64", () => {
    const str = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=";
    let res = getEncoding(["base64", str], 1);

    assert.deepEqual(res, [str, EncodingType.BASE64]);

    res = getEncoding(["b64", str], 1);
    assert.deepEqual(res, [str, EncodingType.BASE64]);

    res = getEncoding(["b64(QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=)"], 1);
    assert.deepEqual(res, [str, EncodingType.BASE64]);

    res = getEncoding(["base64(QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=)"], 1);
    assert.deepEqual(res, [str, EncodingType.BASE64]);
  });

  it("should return corrent Encoding type for base32", () => {
    const str = "MFRGGZDFMY=";
    let res = getEncoding(["base32", str], 1);

    assert.deepEqual(res, [str, EncodingType.BASE32]);

    res = getEncoding(["b32", str], 1);
    assert.deepEqual(res, [str, EncodingType.BASE32]);

    res = getEncoding(["b32(MFRGGZDFMY=)"], 1);
    assert.deepEqual(res, [str, EncodingType.BASE32]);

    res = getEncoding(["base32(MFRGGZDFMY=)"], 1);
    assert.deepEqual(res, [str, EncodingType.BASE32]);
  });

  it("should throw error for wrong decoding data", () => {
    expectRuntimeError(
      () => getEncoding(["base64(././"], 1),
      RUNTIME_ERRORS.TEAL.DECODE_ERROR
    );

    expectRuntimeError(
      () => getEncoding(["b32(././"], 1),
      RUNTIME_ERRORS.TEAL.DECODE_ERROR
    );
  });

  it("should throw error for unkown decoding type", () => {
    expectRuntimeError(
      () => getEncoding(["base6", "(././"], 1),
      RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE
    );
  });

  it("should throw invalid base64 data error", () => {
    expectRuntimeError(
      () => getEncoding(["base64", "AJSHKJ-#"], 1),
      RUNTIME_ERRORS.TEAL.INVALID_BASE64
    );
  });

  it("should throw invalid base32 data error", () => {
    expectRuntimeError(
      () => getEncoding(["base32", "AJSHKJ-#"], 1),
      RUNTIME_ERRORS.TEAL.INVALID_BASE32
    );
  });
});

describe("Parse Binary string to BigInt", () => {
  it("should parse to bigint", () => {
    let res = parseBinaryStrToBigInt(["0"]);
    assert.equal(res, 0n);

    res = parseBinaryStrToBigInt(["0", "1", "0"]);
    assert.equal(res, 2n);

    res = parseBinaryStrToBigInt(["1", "0", "0", "0", "0"]);
    assert.equal(res, 16n);

    res = parseBinaryStrToBigInt(["1"]);
    assert.equal(res, 1n);

    res = parseBinaryStrToBigInt(["0", "0"]);
    assert.equal(res, 0n);

    res = parseBinaryStrToBigInt("101");
    assert.equal(res, 5n);

    res = parseBinaryStrToBigInt("00000");
    assert.equal(res, 0n);

    res = parseBinaryStrToBigInt("1111");
    assert.equal(res, 15n);

    res = parseBinaryStrToBigInt("100");
    assert.equal(res, 4n);
  });
});
