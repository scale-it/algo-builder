import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import {
  Add, Arg, Div, Len, Mul, Sub
} from "../../../src/interpreter/opcode-list";
import { MAX_UINT64 } from "../../../src/lib/constants";
import { toBytes } from "../../../src/lib/parse-data";
import { Stack } from "../../../src/lib/stack";
import type { StackElem } from "../../../src/types";
import { expectTealError } from "../../helpers/errors";

describe("Teal Opcodes", function () {
  describe("Len", function () {
    const stack = new Stack<StackElem>();

    it("should return correct length of string", function () {
      const str = "HelloWorld";
      stack.push(toBytes(str));
      const op = new Len();
      op.execute(stack);

      const len = stack.pop();
      assert.equal(len, BigInt(str.length.toString()));
    });

    it("should throw error with uint64", function () {
      stack.push(BigInt("1000"));
      const op = new Len();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });

  describe("Add", function () {
    const stack = new Stack<StackElem>();

    it("should return correct addition of two unit64", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new Add();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("30"));
    });

    it("should throw error with Add if stack is below min length", function () {
      stack.push(BigInt("1000")); // stack.length() = 1
      const op = new Add();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      );
    });

    it("should throw error if Add is used with strings", function () {
      stack.push(toBytes("str1"));
      stack.push(toBytes("str2"));
      const op = new Add();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should throw overflow error with Add", function () {
      stack.push(MAX_UINT64 - BigInt("5"));
      stack.push(MAX_UINT64 - BigInt("6"));
      const op = new Add();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.UINT64_OVERFLOW
      );
    });
  });

  describe("Sub", function () {
    const stack = new Stack<StackElem>();

    it("should return correct subtraction of two unit64", function () {
      stack.push(BigInt("20"));
      stack.push(BigInt("30"));
      const op = new Sub();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("10"));
    });

    it("should throw error with Sub if stack is below min length", function () {
      stack.push(BigInt("1000")); // stack.length() = 1
      const op = new Sub();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      );
    });

    it("should throw error if Sub is used with strings", function () {
      stack.push(toBytes("str1"));
      stack.push(toBytes("str2"));
      const op = new Sub();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should throw underflow error with Sub if (A - B) < 0", function () {
      stack.push(BigInt("20"));
      stack.push(BigInt("10"));
      const op = new Sub();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.UINT64_UNDERFLOW
      );
    });
  });

  describe("Mul", function () {
    const stack = new Stack<StackElem>();

    it("should return correct multiplication of two unit64", function () {
      stack.push(BigInt("20"));
      stack.push(BigInt("30"));
      const op = new Mul();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("600"));
    });

    it("should throw error with Mul if stack is below min length", function () {
      stack.push(BigInt("1000")); // stack.length() = 1
      const op = new Mul();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      );
    });

    it("should throw error if Mul is used with strings", function () {
      stack.push(toBytes("str1"));
      stack.push(toBytes("str2"));
      const op = new Mul();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should throw overflow error with Mul if (A * B) > max_unit64", function () {
      stack.push(MAX_UINT64 - BigInt("5"));
      stack.push(BigInt(2));
      const op = new Mul();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.UINT64_OVERFLOW
      );
    });
  });

  describe("Div", function () {
    const stack = new Stack<StackElem>();

    it("should return correct division of two unit64", function () {
      stack.push(BigInt("20"));
      stack.push(BigInt("40"));
      const op = new Div();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("2"));
    });

    it("should return 0 on division of two unit64 with A == 0", function () {
      stack.push(BigInt("40"));
      stack.push(BigInt("0"));
      const op = new Div();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should throw error with Div if stack is below min length", function () {
      stack.push(BigInt("1000")); // stack.length() = 1
      const op = new Div();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      );
    });

    it("should throw error if Div is used with strings", function () {
      stack.push(toBytes("str1"));
      stack.push(toBytes("str2"));
      const op = new Div();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });

    it("should panic on A/B if B == 0", function () {
      stack.push(BigInt("0"));
      stack.push(BigInt("10"));
      const op = new Div();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ZERO_DIV
      );
    });
  });

  describe("Arg[N]", function () {
    const stack = new Stack<StackElem>();
    const args = [
      toBytes("Arg0"),
      toBytes("Arg1"),
      toBytes("Arg2"),
      toBytes("Arg3")
    ];

    it("should push arg_0 from argument array", function () {
      const op = new Arg(args[0]);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[0]);
    });

    it("should push arg_1 from argument array", function () {
      const op = new Arg(args[1]);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[1]);
    });

    it("should push arg_2 from argument array", function () {
      const op = new Arg(args[2]);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[2]);
    });

    it("should push arg_3 from argument array", function () {
      const op = new Arg(args[3]);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[3]);
    });

    it("should throw error if accessing arg is not defined", function () {
      const args = [new Uint8Array(0)];
      const op = new Arg(args[1]);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });
});
