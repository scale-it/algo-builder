import { assert } from "chai";

// import { ERRORS } from "../../../src/errors/errors-list";
import { getEncoding } from "../../../src/lib/parse-data";
import { EncodingType } from "../../../src/types";

describe("Get Encoding for Byte Data", () => {
  it("should return corrent Encoding type for string", () => {
    const res = getEncoding(["\"string literal\""], 1);

    assert.deepEqual(res, ["string literal", EncodingType.STRING]);
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
});
