import { assert } from "chai";

import { uint64ToBigEndian } from "../../src/lib/ssc";

describe("Convert integer to big endian", () => {
  /**
   * Note: Expected results are derived from following go code
   * v := uint64(number)
   * buf := make([]byte, 8)
   * binary.BigEndian.PutUint64(buf, v)
   * fmt.Println(buf)
   */
  it("should return correct big endian for given integers", () => {
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
  });

  it("should return correct big endian for bigint", () => {
    let res = uint64ToBigEndian(0n);
    let expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
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

    res = uint64ToBigEndian(0xFFFFFFFFFFFFFFFFn);
    expected = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
    assert.deepEqual(res, expected);
  });
});
