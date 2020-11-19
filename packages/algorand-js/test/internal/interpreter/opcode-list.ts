import { assert } from "chai";

import { ERRORS } from "../../../src/internal/core/errors-list";
import {
  Add, Arg_0, Arg_1, Arg_2, Arg_3, Len
} from "../../../src/internal/interpreter/opcode-list";
import { MAX_UINT64 } from "../../../src/lib/constants";
import { Stack } from "../../../src/lib/stack";
import { expectTealError } from "../../helpers/errors";

describe("Teal Opcodes", function () {
  describe("Len", function () {
    const stack = new Stack<string | bigint>();

    it("should return correct length of string", function () {
      const str = "HelloWorld";
      stack.push(str);
      const op = new Len();
      op.execute(stack);

      const len = stack.pop();
      assert.equal(len, BigInt(str.length));
    });

    it("should throw error with uint64", function () {
      stack.push(BigInt(1000));
      const op = new Len();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_OPERATION
      );
    });
  });

  describe("Add", function () {
    const stack = new Stack<string | bigint>();

    it("should return correct addition of two unit64", function () {
      stack.push(BigInt(10));
      stack.push(BigInt(20));
      const op = new Add();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt(30));
    });

    it("should throw error with Add if stack is below min length", function () {
      stack.push(BigInt(1000)); // stack.length() = 1
      const op = new Add();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      );
    });

    it("should throw error if Add is used with strings", function () {
      stack.push("str1");
      stack.push("str2");
      const op = new Add();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_OPERATION
      );
    });

    it("should throw overflow error with Add", function () {
      stack.push(MAX_UINT64 - BigInt(5));
      stack.push(MAX_UINT64 - BigInt(6));
      const op = new Add();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.UINT64_OVERFLOW
      );
    });
  });

  describe("Arg[N]", function () {
    const stack = new Stack<string | bigint>();
    const args = ["Arg0", "Arg1", "Arg2", "Arg3"];

    it("should push arg_0 from argument array", function () {
      const op = new Arg_0(args);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, args[0]);
    });

    it("should push arg_1 from argument array", function () {
      const op = new Arg_1(args);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, args[1]);
    });

    it("should push arg_2 from argument array", function () {
      const op = new Arg_2(args);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, args[2]);
    });

    it("should push arg_3 from argument array", function () {
      const op = new Arg_3(args);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, args[3]);
    });

    it("should throw error if accessing arg is not defined", function () {
      const args = [123];
      const op = new Arg_1(args);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_OPERATION
      );
    });
  });
});
