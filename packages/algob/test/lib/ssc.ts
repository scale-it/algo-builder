import { assert } from "chai";

import { intToBigEndian } from "../../src/lib/ssc";

describe("Convert integer to big endian", () => {
  /**
   * Note: Expected results are derived from following go code
   * v := uint64(number)
   * buf := make([]byte, 8)
   * binary.BigEndian.PutUint64(buf, v)
   * fmt.Println(buf)
   */
  it("should return correct big endian for given integers", () => {
    let res = intToBigEndian(20);
    let expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 20]);
    assert.deepEqual(res, expected);

    res = intToBigEndian(700000000);
    expected = new Uint8Array([0, 0, 0, 0, 41, 185, 39, 0]);
    assert.deepEqual(res, expected);

    res = intToBigEndian(233654);
    expected = new Uint8Array([0, 0, 0, 0, 0, 3, 144, 182]);
    assert.deepEqual(res, expected);

    res = intToBigEndian(9007199254740991);
    expected = new Uint8Array([0, 31, 255, 255, 255, 255, 255, 255]);
    assert.deepEqual(res, expected);
  });
});
