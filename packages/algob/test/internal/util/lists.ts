import { assert } from "chai";

import { partitionByFn } from "../../../src/internal/util/lists";
import { cmpStr } from "../../../src/lib/comparators";

describe("partitionByFn", function () {
  it("Should return empty list on empty input", function () {
    const output = partitionByFn((_a: any, _b: any) => true, []);
    assert.deepEqual(output, []);
  });

  it("Should not mutate input list", function () {
    const inputs = [1, 1, 2, 3];
    partitionByFn((a: any, b: any) => a !== b, inputs);
    assert.deepEqual(inputs, [1, 1, 2, 3]);
  });

  it("Should allow to find side-by-side-equal subsets", function () {
    const output = partitionByFn((a: any, b: any) => a !== b, [1, 1, 2, 3]);
    assert.deepEqual(output, [[1, 1], [2], [3]]);
  });

  it("Should split list when side-by-side items are equal", function () {
    const output = partitionByFn((a: any, b: any) => a === b, [1, 1, 2, 3]);
    assert.deepEqual(output, [[1], [1, 2, 3]]);
  });

  it("Should group only side-by-side groups, shouldn't change order", function () {
    const output = partitionByFn((a: any, b: any) => a !== b, [1, 1, 2, 3, 2, 2, 1, 1]);
    assert.deepEqual(output, [[1, 1], [2], [3], [2, 2], [1, 1]]);
  });

  it("Should support custom functions", function () {
    const output = partitionByFn((a: string, b: string) => cmpStr(a, b) === 1, ["1", "1", "2", "3", "2"]);
    assert.deepEqual(output, [["1", "1", "2", "3"], ["2"]]);
  });
});
