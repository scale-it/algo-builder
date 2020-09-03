import { assert } from "chai";

import { partitionByFn } from "../../../src/internal/util/lists";

describe("partitionByUnsorted", function () {
  it("Should return empty list on empty input", function () {
    const output = partitionByFn((_a: any, _b: any) => true, []);
    assert.deepEqual(output, []);
  });

  it("Should not mutate input list", function () {
    const inputs = ["1", "1", "2", "3"];
    partitionByFn((a: any, b: any) => a !== b, inputs);
    assert.deepEqual(inputs, ["1", "1", "2", "3"]);
  });

  it("Should return grouped list by not equal", function () {
    const output = partitionByFn((a: any, b: any) => a !== b, ["1", "1", "2", "3"]);
    assert.deepEqual(output, [["1", "1"], ["2"], ["3"]]);
  });

  it("Should return grouped list by equal", function () {
    const output = partitionByFn((a: any, b: any) => a === b, ["1", "1", "2", "3"]);
    assert.deepEqual(output, [["1"], ["1", "2", "3"]]);
  });
});
