import { assert } from "chai";

import { Stack } from "../../../src/lib/stack";

describe("Stack", function () {
  const stack = new Stack<string | bigint>();

  it("assert empty stack", function () {
    assert.equal(0, stack.length());
  });

  it("should throw error while popping empty stack", function () {
    const errMsg = "pop from empty stack";
    assert.throws(() => stack.pop(), errMsg);
  });

  it("should return correct length", function () {
    stack.push(BigInt(1));
    stack.push(BigInt(2));
    assert.equal(2, stack.length());
  });

  it("should push bigint and string", function () {
    stack.push(BigInt(10));
    stack.push("txn");

    const str = stack.pop();
    const num = stack.pop();
    assert.equal(str, "txn");
    assert.equal(num, BigInt(10));
  });
});
