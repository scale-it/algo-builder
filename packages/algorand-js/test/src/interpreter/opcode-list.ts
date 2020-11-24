import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import {
  Add, Arg, Bytec,
  Bytecblock, Div, Intc,
  Intcblock, Len, Mul, Sub
} from "../../../src/interpreter/opcode-list";
import { MAX_UINT8, MAX_UINT64 } from "../../../src/lib/constants";
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
    const args = ["Arg0", "Arg1", "Arg2", "Arg3"].map(toBytes);

    it("should push arg_0 from argument array to stack", function () {
      const op = new Arg(args[0]);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[0]);
    });

    it("should push arg_1 from argument array to stack", function () {
      const op = new Arg(args[1]);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[1]);
    });

    it("should push arg_2 from argument array to stack", function () {
      const op = new Arg(args[2]);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[2]);
    });

    it("should push arg_3 from argument array to stack", function () {
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

  describe("Bytecblock", function () {
    const stack = new Stack<StackElem>();

    it("should throw error if bytecblock length exceeds uint8", function () {
      const interpreter = new Interpreter();
      const bytecblock: Uint8Array[] = [];
      for (let i = 0; i < MAX_UINT8 + 5; i++) {
        bytecblock.push(toBytes("my_byte"));
      }

      const op = new Bytecblock(interpreter, bytecblock);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_ARR_LENGTH
      );
    });

    it("should load byte block to interpreter bytecblock", function () {
      const interpreter = new Interpreter();
      const bytecblock = ["bytec_0", "bytec_1", "bytec_2", "bytec_3"].map(toBytes);
      const op = new Bytecblock(interpreter, bytecblock);
      op.execute(stack);

      assert.deepEqual(bytecblock, interpreter.bytecblock);
    });
  });

  describe("Bytec[N]", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    const bytecblock = ["bytec_0", "bytec_1", "bytec_2", "bytec_3"].map(toBytes);
    interpreter.bytecblock = bytecblock;

    it("should push bytec_0 from bytecblock to stack", function () {
      const op = new Bytec(0, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[0]);
    });

    it("should push bytec_1 from bytecblock to stack", function () {
      const op = new Bytec(1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[1]);
    });

    it("should push bytec_2 from bytecblock to stack", function () {
      const op = new Bytec(2, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[2]);
    });

    it("should push bytec_3 from bytecblock to stack", function () {
      const op = new Bytec(3, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[3]);
    });

    it("should throw error on loading bytec[N] if index is out of bound", function () {
      const op = new Bytec(bytecblock.length + 1, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INDEX_OUT_OF_BOUND
      );
    });
  });

  describe("Intcblock", function () {
    const stack = new Stack<StackElem>();

    it("should throw error if intcblock length exceeds uint8", function () {
      const interpreter = new Interpreter();
      const intcblock: Array<bigint> = [];
      for (let i = 0; i < MAX_UINT8 + 5; i++) {
        intcblock.push(BigInt(i.toString()));
      }

      const op = new Intcblock(interpreter, intcblock);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_ARR_LENGTH
      );
    });

    it("should load intcblock to interpreter intcblock", function () {
      const interpreter = new Interpreter();
      const intcblock = ["0", "1", "2", "3"].map(BigInt);
      const op = new Intcblock(interpreter, intcblock);
      op.execute(stack);

      assert.deepEqual(intcblock, interpreter.intcblock);
    });
  });

  describe("Intc[N]", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    const intcblock = ["0", "1", "2", "3"].map(BigInt);
    interpreter.intcblock = intcblock;

    it("should push intc_0 from intcblock to stack", function () {
      const op = new Intc(0, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[0]);
    });

    it("should push intc_1 from intcblock to stack", function () {
      const op = new Intc(1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[1]);
    });

    it("should push intc_2 from intcblock to stack", function () {
      const op = new Intc(2, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[2]);
    });

    it("should push intc_3 from intcblock to stack", function () {
      const op = new Intc(3, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[3]);
    });

    it("should throw error on loading intc[N] if index is out of bound", function () {
      const op = new Intc(intcblock.length + 1, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INDEX_OUT_OF_BOUND
      );
    });
  });
});
