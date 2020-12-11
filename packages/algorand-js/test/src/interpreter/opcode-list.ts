/* eslint sonarjs/no-identical-functions: 0 */
import { decodeAddress, generateAccount, signBytes } from "algosdk";
import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import {
  Add, Addr, Addw, And, Arg, BitwiseAnd, BitwiseNot, BitwiseOr, BitwiseXor,
  Btoi, Byte, Bytec, Bytecblock, Concat, Div, Dup, Dup2,
  Ed25519verify,
  EqualTo, Err, GreaterThan, GreaterThanEqualTo, Int, Intc,
  Intcblock, Itob,
  Keccak256,
  Len, LessThan, LessThanEqualTo,
  Load, Mod, Mul, Mulw, Not, NotEqualTo, Or, Pragma,
  Sha256, Sha512_256, Store, Sub, Substring,
  Substring3
} from "../../../src/interpreter/opcode-list";
import { DEFAULT_STACK_ELEM, MAX_UINT8, MAX_UINT64, MIN_UINT8 } from "../../../src/lib/constants";
import { convertToBuffer, toBytes } from "../../../src/lib/parse-data";
import { Stack } from "../../../src/lib/stack";
import { EncodingType, StackElem } from "../../../src/types";
import { execExpectError, expectTealError } from "../../helpers/errors";

describe("Teal Opcodes", function () {
  const strArr = ["str1", "str2"].map(toBytes);

  describe("Len", function () {
    const stack = new Stack<StackElem>();

    it("should return correct length of string", function () {
      const str = "HelloWorld";
      stack.push(toBytes(str));
      const op = new Len([], 0);
      op.execute(stack);

      const len = stack.pop();
      assert.equal(len, BigInt(str.length.toString()));
    });

    it("should throw error with uint64", function () {
      stack.push(BigInt("1000"));
      const op = new Len([], 0);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });

  describe("Pragma", () => {
    it("should store pragma version", () => {
      const op = new Pragma(["version", "2"], 1);
      assert.equal(op.version, "2");
    });

    it("should store throw length error", () => {
      expectTealError(
        () => new Pragma(["version", "2", "some-value"], 1),
        ERRORS.TEAL.ASSERT_FIELD_LENGTH
      );
    });
  });

  describe("Add", function () {
    const stack = new Stack<StackElem>();

    it("should return correct addition of two unit64", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new Add([], 0);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("30"));
    });

    it("should throw error with Add if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new Add([], 0), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if Add is used with strings",
      execExpectError(stack, strArr, new Add([], 0), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw overflow error with Add", function () {
      stack.push(MAX_UINT64 - BigInt("5"));
      stack.push(MAX_UINT64 - BigInt("6"));
      const op = new Add([], 0);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.UINT64_OVERFLOW
      );
    });
  });

  describe("Sub", function () {
    const stack = new Stack<StackElem>();

    it("should return correct subtraction of two unit64", function () {
      stack.push(BigInt("30"));
      stack.push(BigInt("20"));
      const op = new Sub([], 0);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("10"));
    });

    it("should throw error with Sub if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new Sub([], 0), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if Sub is used with strings",
      execExpectError(stack, strArr, new Sub([], 0), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw underflow error with Sub if (A - B) < 0", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new Sub([], 0);
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
      const op = new Mul([], 0);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("600"));
    });

    it("should throw error with Mul if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new Mul([], 0), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if Mul is used with strings",
      execExpectError(stack, strArr, new Mul([], 0), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw overflow error with Mul if (A * B) > max_unit64", function () {
      stack.push(MAX_UINT64 - BigInt("5"));
      stack.push(BigInt(2));
      const op = new Mul([], 0);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.UINT64_OVERFLOW
      );
    });
  });

  describe("Div", function () {
    const stack = new Stack<StackElem>();

    it("should return correct division of two unit64", function () {
      stack.push(BigInt("40"));
      stack.push(BigInt("20"));
      const op = new Div([], 0);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("2"));
    });

    it("should return 0 on division of two unit64 with A == 0", function () {
      stack.push(BigInt("0"));
      stack.push(BigInt("40"));
      const op = new Div([], 0);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should throw error with Div if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new Div([], 0), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if Div is used with strings",
      execExpectError(stack, strArr, new Div([], 0), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should panic on A/B if B == 0", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("0"));
      const op = new Div([], 0);
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

  describe("Mod", function () {
    const stack = new Stack<StackElem>();

    it("should return correct modulo of two unit64", function () {
      stack.push(BigInt("5"));
      stack.push(BigInt("2"));
      let op = new Mod();
      op.execute(stack);

      let top = stack.pop();
      assert.equal(top, BigInt("1"));

      stack.push(BigInt("7"));
      stack.push(BigInt("7"));
      op = new Mod();
      op.execute(stack);
      top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should return 0 on modulo of two unit64 with A == 0", function () {
      stack.push(BigInt("0"));
      stack.push(BigInt("4"));
      const op = new Mod();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should throw error with Mod if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new Mod(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if Mod is used with strings",
      execExpectError(stack, strArr, new Mod(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should panic on A % B if B == 0", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("0"));
      const op = new Mod();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ZERO_DIV
      );
    });
  });

  describe("Store", function () {
    const stack = new Stack<StackElem>();

    it("should store uint64 to scratch", function () {
      const interpreter = new Interpreter();
      const val = BigInt("0");
      stack.push(val);

      const op = new Store(0, interpreter);
      op.execute(stack);
      assert.equal(stack.length(), 0); // verify stack is popped
      assert.equal(val, interpreter.scratch[0]);
    });

    it("should store byte[] to scratch", function () {
      const interpreter = new Interpreter();
      const val = toBytes("HelloWorld");
      stack.push(val);

      const op = new Store(0, interpreter);
      op.execute(stack);
      assert.equal(stack.length(), 0); // verify stack is popped
      assert.equal(val, interpreter.scratch[0]);
    });

    it("should throw error on store if index is out of bound", function () {
      const interpreter = new Interpreter();
      stack.push(BigInt("0"));

      const op = new Store(MAX_UINT8 + 5, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INDEX_OUT_OF_BOUND
      );
    });

    it("should throw error on store if stack is empty", function () {
      const interpreter = new Interpreter();
      const stack = new Stack<StackElem>(); // empty stack
      const op = new Store(0, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      );
    });
  });

  describe("Bitwise OR", function () {
    const stack = new Stack<StackElem>();

    it("should return correct bitwise-or of two unit64", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new BitwiseOr();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("30"));
    });

    it("should throw error with bitwise-or if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new BitwiseOr(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-or is used with strings",
      execExpectError(stack, strArr, new BitwiseOr(), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Bitwise AND", function () {
    const stack = new Stack<StackElem>();

    it("should return correct bitwise-and of two unit64", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new BitwiseAnd();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should throw error with bitwise-and if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new BitwiseAnd(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-and is used with strings",
      execExpectError(stack, strArr, new BitwiseAnd(), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Bitwise XOR", function () {
    const stack = new Stack<StackElem>();

    it("should return correct bitwise-xor of two unit64", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new BitwiseXor();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("30"));
    });

    it("should throw error with bitwise-xor if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new BitwiseXor(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-xor is used with strings",
      execExpectError(stack, strArr, new BitwiseXor(), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Bitwise NOT", function () {
    const stack = new Stack<StackElem>();

    it("should return correct bitwise-not of unit64", function () {
      stack.push(BigInt("10"));
      const op = new BitwiseNot();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, ~BigInt("10"));
    });

    it("should throw error with bitwise-not if stack is below min length",
      execExpectError(stack, [], new Add([], 0), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-not is used with string",
      execExpectError(stack, strArr, new BitwiseNot(), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Load", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    const scratch = [BigInt("0"), toBytes("HelloWorld")];
    interpreter.scratch = scratch;

    it("should load uint64 from scratch space to stack", function () {
      const op = new Load(0, interpreter);
      const len = stack.length();

      op.execute(stack);
      assert.equal(len + 1, stack.length()); // verify stack is pushed
      assert.equal(interpreter.scratch[0], stack.pop());
    });

    it("should load byte[] from scratch space to stack", function () {
      const op = new Load(1, interpreter);
      const len = stack.length();

      op.execute(stack);
      assert.equal(len + 1, stack.length()); // verify stack is pushed
      assert.equal(interpreter.scratch[1], stack.pop());
    });

    it("should throw error on load if index is out of bound", function () {
      const op = new Load(MAX_UINT8 + 5, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INDEX_OUT_OF_BOUND
      );
    });

    it("should load default value to stack if value at a slot is not intialized", function () {
      const interpreter = new Interpreter();
      const op = new Load(0, interpreter);
      op.execute(stack);
      assert.equal(DEFAULT_STACK_ELEM, stack.pop());
    });
  });

  describe("Err", function () {
    const stack = new Stack<StackElem>();

    it("should throw TEAL error", function () {
      const op = new Err();
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });
  });

  describe("Sha256", function () {
    const stack = new Stack<StackElem>();

    it("should return correct hash for Sha256", () => {
      stack.push(toBytes("MESSAGE"));
      const op = new Sha256();
      op.execute(stack);

      const expected = Buffer.from(
        "b194d92018d6074234280c5f5b88649c8db14ef4f2c3746d8a23896a0f6f3b66", 'hex');

      const top = stack.pop();
      assert.deepEqual(expected, top);
    });

    it("should throw invalid type error sha256",
      execExpectError(stack, [BigInt("1")], new Sha256(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with Sha256 if stack is below min length",
      execExpectError(stack, [], new Sha256(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("Sha512_256", function () {
    const stack = new Stack<StackElem>();

    it("should return correct hash for Sha512_256", function () {
      stack.push(toBytes("MESSAGE"));
      const op = new Sha512_256();
      op.execute(stack);

      const expected = Buffer.from(
        "f876dfdffd93791dc919586232116786362d434fe59d06097000fcf42bac228b", 'hex');

      const top = stack.pop();
      assert.deepEqual(expected, top);
    });

    it("should throw invalid type error sha512_256",
      execExpectError(stack, [BigInt("1")], new Sha512_256(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with Sha512_256 if stack is below min length",
      execExpectError(stack, [], new Sha512_256(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("keccak256", function () {
    const stack = new Stack<StackElem>();

    it("should return correct hash for keccak256", function () {
      stack.push(toBytes("ALGORAND"));
      const op = new Keccak256();
      op.execute(stack);

      // http://emn178.github.io/online-tools/keccak_256.html
      const expected = Buffer.from(
        "ab0d74c2852292002f95c4a64ebd411ecb5e8a599d4bc2cfc1170547c5f44807", 'hex');

      const top = stack.pop();
      assert.deepEqual(expected, top);
    });

    it("should throw invalid type error Keccak256",
      execExpectError(stack, [BigInt("1")], new Keccak256(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with keccak256 if stack is below min length",
      execExpectError(stack, [], new Keccak256(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("Ed25519verify", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack if signature is valid", function () {
      const account = generateAccount();
      const toSign = new Uint8Array(Buffer.from([1, 9, 25, 49]));
      const signed = signBytes(toSign, account.sk);

      stack.push(toSign); // data
      stack.push(signed); // signature
      stack.push(decodeAddress(account.addr).publicKey); // pk

      const op = new Ed25519verify();
      op.execute(stack);
      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack if signature is invalid", function () {
      const account = generateAccount();
      const toSign = new Uint8Array(Buffer.from([1, 9, 25, 49]));
      const signed = signBytes(toSign, account.sk);
      signed[0] = (Number(signed[0]) + 1) % 256;

      stack.push(toSign); // data
      stack.push(signed); // signature
      stack.push(decodeAddress(account.addr).publicKey); // pk

      const op = new Ed25519verify();
      op.execute(stack);
      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error Ed25519verify",
      execExpectError(stack, ['1', '1', '1'].map(BigInt), new Ed25519verify(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with Ed25519verify if stack is below min length",
      execExpectError(stack, [], new Ed25519verify(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("LessThan", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack because 5 < 10", () => {
      stack.push(BigInt('5'));
      stack.push(BigInt('10'));

      const op = new LessThan();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack as 10 > 5", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('5'));

      const op = new LessThan();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error LessThan",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new LessThan(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error LessThan", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("GreaterThan", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack as 5 > 2", () => {
      stack.push(BigInt('5'));
      stack.push(BigInt('2'));

      const op = new GreaterThan();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack as 50 > 10", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('50'));

      const op = new GreaterThan();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error GreaterThan",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new GreaterThan(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error GreaterThan", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("LessThanEqualTo", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack", () => {
      const op = new LessThanEqualTo();
      stack.push(BigInt('20'));
      stack.push(BigInt('20'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack", () => {
      const op = new LessThanEqualTo();
      stack.push(BigInt('100'));
      stack.push(BigInt('50'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error LessThanEqualTo",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new LessThanEqualTo(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error LessThanEqualTo", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("GreaterThanEqualTo", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack", () => {
      const op = new GreaterThanEqualTo();
      stack.push(BigInt('20'));
      stack.push(BigInt('20'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack", () => {
      const op = new GreaterThanEqualTo();
      stack.push(BigInt('100'));
      stack.push(BigInt('500'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error GreaterThanEqualTo",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new GreaterThanEqualTo(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error GreaterThanEqualTo", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("And", () => {
    const stack = new Stack<StackElem>();

    it("should push true to stack as both values are 1", () => {
      stack.push(BigInt('1'));
      stack.push(BigInt('1'));

      const op = new And();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push false to stack as one value is 0", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('1'));

      const op = new And();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('0'), top);
    });

    it("should throw invalid type error (And)",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new And(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error (And)", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("Or", () => {
    const stack = new Stack<StackElem>();

    it("should push true to stack as one value is 1", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('1'));

      const op = new Or();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push false to stack as both values are 0", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('0'));

      const op = new Or();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('0'), top);
    });

    it("should throw invalid type error (Or)",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new Or(), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error (Or)", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("EqualTo", () => {
    const stack = new Stack<StackElem>();

    it("should push true to stack", () => {
      stack.push(BigInt('22'));
      stack.push(BigInt('22'));

      const op = new EqualTo();
      op.execute(stack);

      let top = stack.pop();
      assert.equal(BigInt('1'), top);

      stack.push(new Uint8Array([1, 2, 3]));
      stack.push(new Uint8Array([1, 2, 3]));

      op.execute(stack);
      top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push false to stack", () => {
      stack.push(BigInt('22'));
      stack.push(BigInt('1'));

      const op = new EqualTo();
      op.execute(stack);

      let top = stack.pop();
      assert.equal(BigInt('0'), top);

      stack.push(new Uint8Array([1, 2, 3]));
      stack.push(new Uint8Array([1, 1, 3]));

      op.execute(stack);
      top = stack.pop();
      assert.equal(BigInt('0'), top);
    });

    it("should throw error", () => {
      stack.push(BigInt('12'));
      stack.push(new Uint8Array([1, 2, 3]));
      const op = new EqualTo();

      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });

  describe("NotEqualTo", () => {
    const stack = new Stack<StackElem>();

    it("should push true to stack", () => {
      stack.push(BigInt('21'));
      stack.push(BigInt('22'));

      const op = new NotEqualTo();
      op.execute(stack);

      let top = stack.pop();
      assert.equal(BigInt('1'), top);

      stack.push(new Uint8Array([1, 2, 3]));
      stack.push(new Uint8Array([1, 1, 3]));

      op.execute(stack);
      top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push false to stack", () => {
      stack.push(BigInt('22'));
      stack.push(BigInt('22'));

      const op = new NotEqualTo();
      op.execute(stack);

      let top = stack.pop();
      assert.equal(BigInt('0'), top);

      stack.push(new Uint8Array([1, 2, 3]));
      stack.push(new Uint8Array([1, 2, 3]));

      op.execute(stack);
      top = stack.pop();
      assert.equal(BigInt('0'), top);
    });

    it("should throw error", () => {
      stack.push(BigInt('12'));
      stack.push(new Uint8Array([1, 2, 3]));
      const op = new EqualTo();

      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_TYPE
      );
    });
  });

  describe("Not", () => {
    const stack = new Stack<StackElem>();

    it("should push 1", () => {
      stack.push(BigInt('0'));
      const op = new Not();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push 0", () => {
      stack.push(BigInt('122'));
      const op = new Not();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('0'), top);
    });
  });

  describe("itob", () => {
    const stack = new Stack<StackElem>();

    it("should convert int to bytes", () => {
      stack.push(BigInt('4'));
      const op = new Itob();
      op.execute(stack);

      const top = stack.pop();
      const expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 4]);
      assert.deepEqual(top, expected);
    });

    it("should throw invalid type error",
      execExpectError(stack, [new Uint8Array([1, 2])], new Itob(), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("btoi", () => {
    const stack = new Stack<StackElem>();

    it("should convert bytes to int", () => {
      stack.push(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]));
      const op = new Btoi();
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should throw invalid type error",
      execExpectError(stack, [new Uint8Array([0, 1, 1, 1, 1, 1, 1, 1, 0])],
        new Btoi(), ERRORS.TEAL.LONG_INPUT_ERROR)
    );
  });

  describe("Addw", () => {
    const stack = new Stack<StackElem>();

    it("should add carry", () => {
      stack.push(MAX_UINT64);
      stack.push(BigInt('3'));
      const op = new Addw();
      op.execute(stack);

      const valueSUM = stack.pop();
      const valueCARRY = stack.pop();
      assert.equal(valueSUM, BigInt('2'));
      assert.equal(valueCARRY, BigInt('1'));
    });

    it("should not add carry", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('3'));
      const op = new Addw();
      op.execute(stack);

      const valueSUM = stack.pop();
      const valueCARRY = stack.pop();
      assert.equal(valueSUM, BigInt('13'));
      assert.equal(valueCARRY, BigInt('0'));
    });
  });

  describe("Mulw", () => {
    const stack = new Stack<StackElem>();

    it("should return correct low and high value", () => {
      stack.push(BigInt('4581298449'));
      stack.push(BigInt('9162596898'));
      const op = new Mulw();
      op.execute(stack);

      const low = stack.pop();
      const high = stack.pop();
      assert.equal(low, BigInt('5083102810200507970'));
      assert.equal(high, BigInt('2'));
    });

    it("should return correct low and high value on big numbers", () => {
      stack.push(MAX_UINT64 - BigInt('2'));
      stack.push(BigInt('9162596898'));
      const op = new Mulw();
      op.execute(stack);

      const low = stack.pop();
      const high = stack.pop();
      assert.equal(low, BigInt('18446744046221760922'));
      assert.equal(high, BigInt('9162596897'));
    });

    it("high bits should be 0", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('3'));
      const op = new Mulw();
      op.execute(stack);

      const low = stack.pop();
      const high = stack.pop();
      assert.equal(low, BigInt('30'));
      assert.equal(high, BigInt('0'));
    });

    it("low and high should be 0 on a*b if a or b is 0", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('3'));
      const op = new Mulw();
      op.execute(stack);

      const low = stack.pop();
      const high = stack.pop();
      assert.equal(low, BigInt('0'));
      assert.equal(high, BigInt('0'));
    });

    it("should throw stack length error",
      execExpectError(
        stack,
        [BigInt('3')],
        new Mulw(),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      )
    );

    it("should throw error if type is invalid",
      execExpectError(
        stack,
        ["str1", "str2"].map(toBytes),
        new Mulw(),
        ERRORS.TEAL.INVALID_TYPE
      )
    );
  });

  describe("Dup", () => {
    const stack = new Stack<StackElem>();

    it("should duplicate value", () => {
      stack.push(BigInt('2'));
      const op = new Dup();
      op.execute(stack);

      const value = stack.pop();
      const dupValue = stack.pop();
      assert.equal(value, BigInt('2'));
      assert.equal(dupValue, BigInt('2'));
    });
  });

  describe("Dup2", () => {
    const stack = new Stack<StackElem>();

    it("should duplicate value(A, B -> A, B, A, B)", () => {
      stack.push(BigInt('2'));
      stack.push(BigInt('3'));
      const op = new Dup2();
      op.execute(stack);

      const arr = [];
      arr.push(stack.pop());
      arr.push(stack.pop());
      arr.push(stack.pop());
      arr.push(stack.pop());

      assert.deepEqual(arr, ['3', '2', '3', '2'].map(BigInt));
    });

    it("should throw stack length error",
      execExpectError(stack, [new Uint8Array([1, 2])], new Dup2(), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("Concat", () => {
    const stack = new Stack<StackElem>();

    it("should concat two byte strings", () => {
      stack.push(new Uint8Array([3, 2, 1]));
      stack.push(new Uint8Array([1, 2, 3]));
      const op = new Concat();
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, new Uint8Array([1, 2, 3, 3, 2, 1]));
    });

    it("should throw error as byte strings too long", () => {
      stack.push(new Uint8Array(4000));
      stack.push(new Uint8Array(1000));
      const op = new Concat();

      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.CONCAT_ERROR
      );
    });
  });

  describe("Substring", function () {
    const stack = new Stack<StackElem>();
    const start = BigInt('0');
    const end = BigInt('4');

    it("should return correct substring", function () {
      stack.push(toBytes("Algorand"));
      const op = new Substring(start, end);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(Buffer.from("Algo"), top);
    });

    it("should throw Invalid type error",
      execExpectError(
        stack,
        [BigInt('1')],
        new Substring(start, end),
        ERRORS.TEAL.INVALID_TYPE
      )
    );

    it("should throw error if start is not uint8", function () {
      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring(BigInt(MIN_UINT8 - 5), end),
        ERRORS.TEAL.INVALID_UINT8
      );

      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring(BigInt(MAX_UINT8 + 5), end),
        ERRORS.TEAL.INVALID_UINT8
      );
    });

    it("should throw error if end is not uint8", function () {
      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring(start, BigInt(MIN_UINT8 - 5)),
        ERRORS.TEAL.INVALID_UINT8
      );

      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring(start, BigInt(MAX_UINT8 + 5)),
        ERRORS.TEAL.INVALID_UINT8
      );
    });

    it("should throw error because start > end",
      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring(end + BigInt('5'), end),
        ERRORS.TEAL.SUBSTRING_END_BEFORE_START
      )
    );

    it("should throw error because range beyong string",
      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring(start, start + BigInt('40')),
        ERRORS.TEAL.SUBSTRING_RANGE_BEYOND
      )
    );
  });

  describe("Substring3", function () {
    const stack = new Stack<StackElem>();

    it("should return correct substring", function () {
      stack.push(BigInt('0'));
      stack.push(BigInt('4'));
      stack.push(toBytes("Algorand"));

      const op = new Substring3();
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(Buffer.from("Algo"), top);
    });

    it("should throw Invalid type error",
      execExpectError(
        stack,
        ['4', '0', '1234'].map(BigInt),
        new Substring3(),
        ERRORS.TEAL.INVALID_TYPE
      )
    );

    it("should throw error because start > end", function () {
      const end = BigInt('4');
      const start = end + BigInt('1');
      execExpectError(
        stack,
        [start, end, toBytes("Algorand")],
        new Substring3(),
        ERRORS.TEAL.SUBSTRING_END_BEFORE_START
      );
    });

    it("should throw error because range beyong string",
      execExpectError(
        stack,
        [BigInt('0'), BigInt('40'), toBytes("Algorand")],
        new Substring3(),
        ERRORS.TEAL.SUBSTRING_RANGE_BEYOND
      )
    );
  });

  describe("Pseudo-Ops", function () {
    const stack = new Stack<StackElem>();

    it("Int: should push uint64 to stack", function () {
      const op = new Int([MAX_UINT64.toString()], 0);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.equal(MAX_UINT64, stack.pop());
    });

    it("Addr: should push addr to stack", function () {
      const addr = "SOEI4UA72A7ZL5P25GNISSVWW724YABSGZ7GHW5ERV4QKK2XSXLXGXPG5Y";
      const op = new Addr([addr], 0);
      op.execute(stack);
      assert.equal(1, stack.length());
      assert.deepEqual(decodeAddress(addr).publicKey, stack.pop());
    });

    it("Byte: should push parsed base64 string as bytes to stack", function () {
      const base64Str = "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=";
      const bytes = new Uint8Array(Buffer.from(base64Str, 'base64'));

      const op = new Byte(base64Str, EncodingType.BASE64);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });

    it("Byte: should push parsed base32 string as bytes to stack", function () {
      const base32Str = "MFRGGZDFMY======";
      const bytes = new Uint8Array(convertToBuffer(base32Str, EncodingType.BASE32));

      const op = new Byte(base32Str, EncodingType.BASE32);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });

    it("Byte: should push parsed hex string as bytes to stack", function () {
      const hexStr = "250001000192CD0000002F6D6E742F72"; // original: 0x250001000192CD0000002F6D6E742F72
      const bytes = new Uint8Array(Buffer.from(hexStr, 'hex'));

      const op = new Byte(hexStr, EncodingType.HEX);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });

    it("Byte: should push string literal as bytes to stack", function () {
      const str = "Algorand";
      const bytes = new Uint8Array(Buffer.from(str));

      const op = new Byte(str);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });
  });
});
