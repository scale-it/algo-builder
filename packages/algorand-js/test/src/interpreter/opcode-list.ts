/* eslint sonarjs/no-identical-functions: 0 */
import { decodeAddress, generateAccount, signBytes } from "algosdk";
import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import {
  Add, Addr, Addw, And, Arg, BitwiseAnd, BitwiseNot, BitwiseOr, BitwiseXor,
  Branch,
  BranchIfNotZero,
  BranchIfZero,
  Btoi, Byte, Bytec, Bytecblock, Concat, Div, Dup, Dup2,
  Ed25519verify,
  EqualTo, Err, GreaterThan, GreaterThanEqualTo, Gtxn, Gtxna,
  Int, Intc,
  Intcblock, Itob,
  Keccak256,
  Label,
  Len, LessThan, LessThanEqualTo,
  Load, Mod, Mul, Mulw, Not, NotEqualTo, Or, Pragma,
  Return,
  Sha256, Sha512_256, Store, Sub, Substring,
  Substring3, Txn, Txna
} from "../../../src/interpreter/opcode-list";
import { parseToStackElem } from "../../../src/interpreter/txn";
import { DEFAULT_STACK_ELEM, MAX_UINT8, MAX_UINT64, MIN_UINT8 } from "../../../src/lib/constants";
import { convertToBuffer, toBytes } from "../../../src/lib/parse-data";
import { Stack } from "../../../src/lib/stack";
import { EncodingType, StackElem } from "../../../src/types";
import { execExpectError, expectTealError } from "../../helpers/errors";
import { TXN_OBJ } from "../../mocks/txn";

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
        ERRORS.TEAL.ASSERT_LENGTH
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
    const interpreter = new Interpreter();
    const args = ["Arg0", "Arg1", "Arg2", "Arg3"].map(toBytes);
    interpreter.args = args;

    it("should push arg_0 from argument array to stack", function () {
      const op = new Arg(["0"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[0]);
    });

    it("should push arg_1 from argument array to stack", function () {
      const op = new Arg(["1"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[1]);
    });

    it("should push arg_2 from argument array to stack", function () {
      const op = new Arg(["2"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[2]);
    });

    it("should push arg_3 from argument array to stack", function () {
      const op = new Arg(["3"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, args[3]);
    });

    it("should throw error if accessing arg is not defined", function () {
      expectTealError(
        () => new Arg(["5"], 1, interpreter),
        ERRORS.TEAL.INDEX_OUT_OF_BOUND
      );
    });
  });

  describe("Bytecblock", function () {
    const stack = new Stack<StackElem>();

    it("should throw error if bytecblock length exceeds uint8", function () {
      const interpreter = new Interpreter();
      const bytecblock: string[] = [];
      for (let i = 0; i < MAX_UINT8 + 5; i++) {
        bytecblock.push("my_byte");
      }

      const op = new Bytecblock(bytecblock, 1, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_ARR_LENGTH
      );
    });

    it("should load byte block to interpreter bytecblock", function () {
      const interpreter = new Interpreter();
      const bytecblock = ["bytec_0", "bytec_1", "bytec_2", "bytec_3"];
      const op = new Bytecblock(bytecblock, 1, interpreter);
      op.execute(stack);

      const expected: Uint8Array[] = [];
      for (const val of bytecblock) {
        expected.push(toBytes(val));
      }
      assert.deepEqual(expected, interpreter.bytecblock);
    });
  });

  describe("Bytec[N]", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    const bytecblock = ["bytec_0", "bytec_1", "bytec_2", "bytec_3"].map(toBytes);
    interpreter.bytecblock = bytecblock;

    it("should push bytec_0 from bytecblock to stack", function () {
      const op = new Bytec(["0"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[0]);
    });

    it("should push bytec_1 from bytecblock to stack", function () {
      const op = new Bytec(["1"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[1]);
    });

    it("should push bytec_2 from bytecblock to stack", function () {
      const op = new Bytec(["2"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[2]);
    });

    it("should push bytec_3 from bytecblock to stack", function () {
      const op = new Bytec(["3"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, bytecblock[3]);
    });

    it("should throw error on loading bytec[N] if index is out of bound", function () {
      const op = new Bytec(["5"], 1, interpreter);
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
      const intcblock: string[] = [];
      for (let i = 0; i < MAX_UINT8 + 5; i++) {
        intcblock.push(i.toString());
      }

      const op = new Intcblock(intcblock, 1, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.ASSERT_ARR_LENGTH
      );
    });

    it("should load intcblock to interpreter intcblock", function () {
      const interpreter = new Interpreter();
      const intcblock = ["0", "1", "2", "3"];
      const op = new Intcblock(intcblock, 1, interpreter);
      op.execute(stack);

      assert.deepEqual(intcblock.map(BigInt), interpreter.intcblock);
    });
  });

  describe("Intc[N]", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    const intcblock = ["0", "1", "2", "3"].map(BigInt);
    interpreter.intcblock = intcblock;

    it("should push intc_0 from intcblock to stack", function () {
      const op = new Intc(["0"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[0]);
    });

    it("should push intc_1 from intcblock to stack", function () {
      const op = new Intc(["1"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[1]);
    });

    it("should push intc_2 from intcblock to stack", function () {
      const op = new Intc(["2"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[2]);
    });

    it("should push intc_3 from intcblock to stack", function () {
      const op = new Intc(["3"], 1, interpreter);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, intcblock[3]);
    });

    it("should throw error on loading intc[N] if index is out of bound", function () {
      const op = new Intc(["5"], 1, interpreter);
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
      let op = new Mod([], 1);
      op.execute(stack);

      let top = stack.pop();
      assert.equal(top, BigInt("1"));

      stack.push(BigInt("7"));
      stack.push(BigInt("7"));
      op = new Mod([], 1);
      op.execute(stack);
      top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should return 0 on modulo of two unit64 with A == 0", function () {
      stack.push(BigInt("0"));
      stack.push(BigInt("4"));
      const op = new Mod([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should throw error with Mod if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new Mod([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if Mod is used with strings",
      execExpectError(stack, strArr, new Mod([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should panic on A % B if B == 0", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("0"));
      const op = new Mod([], 1);
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

      const op = new Store(["0"], 1, interpreter);
      op.execute(stack);
      assert.equal(stack.length(), 0); // verify stack is popped
      assert.equal(val, interpreter.scratch[0]);
    });

    it("should store byte[] to scratch", function () {
      const interpreter = new Interpreter();
      const val = toBytes("HelloWorld");
      stack.push(val);

      const op = new Store(["0"], 1, interpreter);
      op.execute(stack);
      assert.equal(stack.length(), 0); // verify stack is popped
      assert.equal(val, interpreter.scratch[0]);
    });

    it("should throw error on store if index is out of bound", function () {
      const interpreter = new Interpreter();
      stack.push(BigInt("0"));

      const op = new Store([(MAX_UINT8 + 5).toString()], 1, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INDEX_OUT_OF_BOUND
      );
    });

    it("should throw error on store if stack is empty", function () {
      const interpreter = new Interpreter();
      const stack = new Stack<StackElem>(); // empty stack
      const op = new Store(["0"], 1, interpreter);
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
      const op = new BitwiseOr([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("30"));
    });

    it("should throw error with bitwise-or if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new BitwiseOr([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-or is used with strings",
      execExpectError(stack, strArr, new BitwiseOr([], 1), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Bitwise AND", function () {
    const stack = new Stack<StackElem>();

    it("should return correct bitwise-and of two unit64", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new BitwiseAnd([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("0"));
    });

    it("should throw error with bitwise-and if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new BitwiseAnd([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-and is used with strings",
      execExpectError(stack, strArr, new BitwiseAnd([], 1), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Bitwise XOR", function () {
    const stack = new Stack<StackElem>();

    it("should return correct bitwise-xor of two unit64", function () {
      stack.push(BigInt("10"));
      stack.push(BigInt("20"));
      const op = new BitwiseXor([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt("30"));
    });

    it("should throw error with bitwise-xor if stack is below min length",
      execExpectError(stack, [BigInt("1000")], new BitwiseXor([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-xor is used with strings",
      execExpectError(stack, strArr, new BitwiseXor([], 1), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Bitwise NOT", function () {
    const stack = new Stack<StackElem>();

    it("should return correct bitwise-not of unit64", function () {
      stack.push(BigInt("10"));
      const op = new BitwiseNot([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, ~BigInt("10"));
    });

    it("should throw error with bitwise-not if stack is below min length",
      execExpectError(stack, [], new Add([], 0), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );

    it("should throw error if bitwise-not is used with string",
      execExpectError(stack, strArr, new BitwiseNot([], 1), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("Load", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    const scratch = [BigInt("0"), toBytes("HelloWorld")];
    interpreter.scratch = scratch;

    it("should load uint64 from scratch space to stack", function () {
      const op = new Load(["0"], 1, interpreter);
      const len = stack.length();

      op.execute(stack);
      assert.equal(len + 1, stack.length()); // verify stack is pushed
      assert.equal(interpreter.scratch[0], stack.pop());
    });

    it("should load byte[] from scratch space to stack", function () {
      const op = new Load(["1"], 1, interpreter);
      const len = stack.length();

      op.execute(stack);
      assert.equal(len + 1, stack.length()); // verify stack is pushed
      assert.equal(interpreter.scratch[1], stack.pop());
    });

    it("should throw error on load if index is out of bound", function () {
      const op = new Load([(MAX_UINT8 + 5).toString()], 1, interpreter);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INDEX_OUT_OF_BOUND
      );
    });

    it("should load default value to stack if value at a slot is not intialized", function () {
      const interpreter = new Interpreter();
      const op = new Load(["0"], 1, interpreter);
      op.execute(stack);
      assert.equal(DEFAULT_STACK_ELEM, stack.pop());
    });
  });

  describe("Err", function () {
    const stack = new Stack<StackElem>();

    it("should throw TEAL error", function () {
      const op = new Err([], 1);
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
      const op = new Sha256([], 1);
      op.execute(stack);

      const expected = Buffer.from(
        "b194d92018d6074234280c5f5b88649c8db14ef4f2c3746d8a23896a0f6f3b66", 'hex');

      const top = stack.pop();
      assert.deepEqual(expected, top);
    });

    it("should throw invalid type error sha256",
      execExpectError(stack, [BigInt("1")], new Sha256([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with Sha256 if stack is below min length",
      execExpectError(stack, [], new Sha256([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("Sha512_256", function () {
    const stack = new Stack<StackElem>();

    it("should return correct hash for Sha512_256", function () {
      stack.push(toBytes("MESSAGE"));
      const op = new Sha512_256([], 1);
      op.execute(stack);

      const expected = Buffer.from(
        "f876dfdffd93791dc919586232116786362d434fe59d06097000fcf42bac228b", 'hex');

      const top = stack.pop();
      assert.deepEqual(expected, top);
    });

    it("should throw invalid type error sha512_256",
      execExpectError(stack, [BigInt("1")], new Sha512_256([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with Sha512_256 if stack is below min length",
      execExpectError(stack, [], new Sha512_256([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("keccak256", function () {
    const stack = new Stack<StackElem>();

    it("should return correct hash for keccak256", function () {
      stack.push(toBytes("ALGORAND"));
      const op = new Keccak256([], 1);
      op.execute(stack);

      // http://emn178.github.io/online-tools/keccak_256.html
      const expected = Buffer.from(
        "ab0d74c2852292002f95c4a64ebd411ecb5e8a599d4bc2cfc1170547c5f44807", 'hex');

      const top = stack.pop();
      assert.deepEqual(expected, top);
    });

    it("should throw invalid type error Keccak256",
      execExpectError(stack, [BigInt("1")], new Keccak256([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with keccak256 if stack is below min length",
      execExpectError(stack, [], new Keccak256([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
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

      const op = new Ed25519verify([], 1);
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

      const op = new Ed25519verify([], 1);
      op.execute(stack);
      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error Ed25519verify",
      execExpectError(stack, ['1', '1', '1'].map(BigInt), new Ed25519verify([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw error with Ed25519verify if stack is below min length",
      execExpectError(stack, [], new Ed25519verify([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("LessThan", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack because 5 < 10", () => {
      stack.push(BigInt('5'));
      stack.push(BigInt('10'));

      const op = new LessThan([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack as 10 > 5", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('5'));

      const op = new LessThan([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error LessThan",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new LessThan([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error LessThan", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("GreaterThan", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack as 5 > 2", () => {
      stack.push(BigInt('5'));
      stack.push(BigInt('2'));

      const op = new GreaterThan([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack as 50 > 10", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('50'));

      const op = new GreaterThan([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error GreaterThan",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new GreaterThan([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error GreaterThan", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("LessThanEqualTo", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack", () => {
      const op = new LessThanEqualTo([], 1);
      stack.push(BigInt('20'));
      stack.push(BigInt('20'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack", () => {
      const op = new LessThanEqualTo([], 1);
      stack.push(BigInt('100'));
      stack.push(BigInt('50'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error LessThanEqualTo",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new LessThanEqualTo([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error LessThanEqualTo", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("GreaterThanEqualTo", function () {
    const stack = new Stack<StackElem>();

    it("should push 1 to stack", () => {
      const op = new GreaterThanEqualTo([], 1);
      stack.push(BigInt('20'));
      stack.push(BigInt('20'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should push 0 to stack", () => {
      const op = new GreaterThanEqualTo([], 1);
      stack.push(BigInt('100'));
      stack.push(BigInt('500'));

      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('0'));
    });

    it("should throw invalid type error GreaterThanEqualTo",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new GreaterThanEqualTo([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error GreaterThanEqualTo", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("And", () => {
    const stack = new Stack<StackElem>();

    it("should push true to stack as both values are 1", () => {
      stack.push(BigInt('1'));
      stack.push(BigInt('1'));

      const op = new And([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push false to stack as one value is 0", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('1'));

      const op = new And([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('0'), top);
    });

    it("should throw invalid type error (And)",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new And([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error (And)", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("Or", () => {
    const stack = new Stack<StackElem>();

    it("should push true to stack as one value is 1", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('1'));

      const op = new Or([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push false to stack as both values are 0", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('0'));

      const op = new Or([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('0'), top);
    });

    it("should throw invalid type error (Or)",
      execExpectError(stack,
        [new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
        new Or([], 1), ERRORS.TEAL.INVALID_TYPE)
    );

    it("should throw stack length error (Or)", execExpectError(new Stack<StackElem>(),
      [BigInt('1')], new LessThan([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("EqualTo", () => {
    const stack = new Stack<StackElem>();

    it("should push true to stack", () => {
      stack.push(BigInt('22'));
      stack.push(BigInt('22'));

      const op = new EqualTo([], 1);
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

      const op = new EqualTo([], 1);
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
      const op = new EqualTo([], 1);

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

      const op = new NotEqualTo([], 1);
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

      const op = new NotEqualTo([], 1);
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
      const op = new EqualTo([], 1);

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
      const op = new Not([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('1'), top);
    });

    it("should push 0", () => {
      stack.push(BigInt('122'));
      const op = new Not([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(BigInt('0'), top);
    });
  });

  describe("itob", () => {
    const stack = new Stack<StackElem>();

    it("should convert int to bytes", () => {
      stack.push(BigInt('4'));
      const op = new Itob([], 1);
      op.execute(stack);

      const top = stack.pop();
      const expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 4]);
      assert.deepEqual(top, expected);
    });

    it("should throw invalid type error",
      execExpectError(stack, [new Uint8Array([1, 2])], new Itob([], 1), ERRORS.TEAL.INVALID_TYPE)
    );
  });

  describe("btoi", () => {
    const stack = new Stack<StackElem>();

    it("should convert bytes to int", () => {
      stack.push(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]));
      const op = new Btoi([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.equal(top, BigInt('1'));
    });

    it("should throw invalid type error",
      execExpectError(stack, [new Uint8Array([0, 1, 1, 1, 1, 1, 1, 1, 0])],
        new Btoi([], 1), ERRORS.TEAL.LONG_INPUT_ERROR)
    );
  });

  describe("Addw", () => {
    const stack = new Stack<StackElem>();

    it("should add carry", () => {
      stack.push(MAX_UINT64);
      stack.push(BigInt('3'));
      const op = new Addw([], 1);
      op.execute(stack);

      const valueSUM = stack.pop();
      const valueCARRY = stack.pop();
      assert.equal(valueSUM, BigInt('2'));
      assert.equal(valueCARRY, BigInt('1'));
    });

    it("should not add carry", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('3'));
      const op = new Addw([], 1);
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
      const op = new Mulw([], 1);
      op.execute(stack);

      const low = stack.pop();
      const high = stack.pop();
      assert.equal(low, BigInt('5083102810200507970'));
      assert.equal(high, BigInt('2'));
    });

    it("should return correct low and high value on big numbers", () => {
      stack.push(MAX_UINT64 - BigInt('2'));
      stack.push(BigInt('9162596898'));
      const op = new Mulw([], 1);
      op.execute(stack);

      const low = stack.pop();
      const high = stack.pop();
      assert.equal(low, BigInt('18446744046221760922'));
      assert.equal(high, BigInt('9162596897'));
    });

    it("high bits should be 0", () => {
      stack.push(BigInt('10'));
      stack.push(BigInt('3'));
      const op = new Mulw([], 1);
      op.execute(stack);

      const low = stack.pop();
      const high = stack.pop();
      assert.equal(low, BigInt('30'));
      assert.equal(high, BigInt('0'));
    });

    it("low and high should be 0 on a*b if a or b is 0", () => {
      stack.push(BigInt('0'));
      stack.push(BigInt('3'));
      const op = new Mulw([], 1);
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
        new Mulw([], 1),
        ERRORS.TEAL.ASSERT_STACK_LENGTH
      )
    );

    it("should throw error if type is invalid",
      execExpectError(
        stack,
        ["str1", "str2"].map(toBytes),
        new Mulw([], 1),
        ERRORS.TEAL.INVALID_TYPE
      )
    );
  });

  describe("Dup", () => {
    const stack = new Stack<StackElem>();

    it("should duplicate value", () => {
      stack.push(BigInt('2'));
      const op = new Dup([], 1);
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
      const op = new Dup2([], 1);
      op.execute(stack);

      const arr = [];
      arr.push(stack.pop());
      arr.push(stack.pop());
      arr.push(stack.pop());
      arr.push(stack.pop());

      assert.deepEqual(arr, ['3', '2', '3', '2'].map(BigInt));
    });

    it("should throw stack length error",
      execExpectError(stack, [new Uint8Array([1, 2])], new Dup2([], 1), ERRORS.TEAL.ASSERT_STACK_LENGTH)
    );
  });

  describe("Concat", () => {
    const stack = new Stack<StackElem>();

    it("should concat two byte strings", () => {
      stack.push(new Uint8Array([3, 2, 1]));
      stack.push(new Uint8Array([1, 2, 3]));
      const op = new Concat([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(top, new Uint8Array([1, 2, 3, 3, 2, 1]));
    });

    it("should throw error as byte strings too long", () => {
      stack.push(new Uint8Array(4000));
      stack.push(new Uint8Array(1000));
      const op = new Concat([], 1);

      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.CONCAT_ERROR
      );
    });
  });

  describe("Substring", function () {
    const stack = new Stack<StackElem>();
    const start = "0";
    const end = "4";

    it("should return correct substring", function () {
      stack.push(toBytes("Algorand"));
      const op = new Substring([start, end], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(Buffer.from("Algo"), top);
    });

    it("should throw Invalid type error",
      execExpectError(
        stack,
        [BigInt('1')],
        new Substring([start, end], 1),
        ERRORS.TEAL.INVALID_TYPE
      )
    );

    it("should throw error if start is not uint8", function () {
      stack.push(toBytes("Algorand"));

      expectTealError(
        () => new Substring([(MIN_UINT8 - 5).toString(), end], 1),
        ERRORS.TEAL.INVALID_TYPE
      );

      const op = new Substring([(MAX_UINT8 + 5).toString(), end], 1);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_UINT8
      );
    });

    it("should throw error if end is not uint8", function () {
      stack.push(toBytes("Algorand"));

      expectTealError(
        () => new Substring([start, (MIN_UINT8 - 5).toString()], 1),
        ERRORS.TEAL.INVALID_TYPE
      );

      const op = new Substring([start, (MAX_UINT8 + 5).toString()], 1);
      expectTealError(
        () => op.execute(stack),
        ERRORS.TEAL.INVALID_UINT8
      );
    });

    it("should throw error because start > end",
      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring(["9", end], 1),
        ERRORS.TEAL.SUBSTRING_END_BEFORE_START
      )
    );

    it("should throw error because range beyong string",
      execExpectError(
        stack,
        [toBytes("Algorand")],
        new Substring([start, "40"], 1),
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

      const op = new Substring3([], 1);
      op.execute(stack);

      const top = stack.pop();
      assert.deepEqual(Buffer.from("Algo"), top);
    });

    it("should throw Invalid type error",
      execExpectError(
        stack,
        ['4', '0', '1234'].map(BigInt),
        new Substring3([], 1),
        ERRORS.TEAL.INVALID_TYPE
      )
    );

    it("should throw error because start > end", function () {
      const end = BigInt('4');
      const start = end + BigInt('1');
      execExpectError(
        stack,
        [start, end, toBytes("Algorand")],
        new Substring3([], 1),
        ERRORS.TEAL.SUBSTRING_END_BEFORE_START
      );
    });

    it("should throw error because range beyong string",
      execExpectError(
        stack,
        [BigInt('0'), BigInt('40'), toBytes("Algorand")],
        new Substring3([], 1),
        ERRORS.TEAL.SUBSTRING_RANGE_BEYOND
      )
    );
  });

  describe("Branch Ops", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    const logic = [
      new Int(['1'], 0),
      new Int(['2'], 1),
      new Branch(["dumb"], 2, interpreter),
      new Int(['3'], 3),
      new Label(["dumb:"], 4),
      new Int(['3'], 5)
    ];
    interpreter.instructions = logic;

    describe("Branch: unconditional", function () {
      it("should jump unconditionally to branch dump", function () {
        const op = new Branch(["dumb"], 2, interpreter);
        op.execute(stack);
        assert.equal(4, interpreter.instructionIndex);
      });

      it("should throw error if label is not defined",
        execExpectError(
          stack,
          [],
          new Branch(["some-branch-1"], 0, interpreter),
          ERRORS.TEAL.LABEL_NOT_FOUND
        )
      );
    });

    describe("BranchIfZero", function () {
      it("should jump to branch if top of stack is zero", function () {
        interpreter.instructionIndex = 0;

        stack.push(BigInt('0'));
        const op = new BranchIfZero(["dumb"], 2, interpreter);
        op.execute(stack);
        assert.equal(4, interpreter.instructionIndex);
      });

      it("should not jump to branch if top of stack is not zero", function () {
        interpreter.instructionIndex = 0;

        stack.push(BigInt('5'));
        const op = new BranchIfZero(["dumb"], 2, interpreter);
        op.execute(stack);
        assert.equal(0, interpreter.instructionIndex);
      });

      it("should throw error if label is not defined for bz",
        execExpectError(
          stack,
          [BigInt('0')],
          new BranchIfZero(["some-branch-2"], 0, interpreter),
          ERRORS.TEAL.LABEL_NOT_FOUND
        )
      );
    });

    describe("BranchIfNotZero", function () {
      it("should not jump to branch if top of stack is zero", function () {
        interpreter.instructionIndex = 0;

        stack.push(BigInt('0'));
        const op = new BranchIfNotZero(["dumb"], 2, interpreter);
        op.execute(stack);
        assert.equal(0, interpreter.instructionIndex);
      });

      it("should jump to branch if top of stack is not zero", function () {
        interpreter.instructionIndex = 0;

        stack.push(BigInt('5'));
        const op = new BranchIfNotZero(["dumb"], 2, interpreter);
        op.execute(stack);
        assert.equal(4, interpreter.instructionIndex);
      });

      it("should throw error if label is not defined for bnz",
        execExpectError(
          stack,
          [BigInt('5')],
          new BranchIfNotZero(["some-branch-3"], 0, interpreter),
          ERRORS.TEAL.LABEL_NOT_FOUND
        )
      );
    });
  });

  describe("Return", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();

    it("should return by taking last value from stack as success", function () {
      stack.push(BigInt('1'));
      stack.push(BigInt('2'));

      const op = new Return([], 0, interpreter);
      op.execute(stack);
      assert.equal(1, stack.length());
      assert.equal(BigInt('2'), stack.pop());
    });
  });

  describe("Transaction opcodes", function () {
    const stack = new Stack<StackElem>();
    const interpreter = new Interpreter();
    interpreter.tx = TXN_OBJ;

    describe("Txn: Common Fields", function () {
      it("should push txn fee to stack", function () {
        const op = new Txn('Fee', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(parseToStackElem(TXN_OBJ.fee, 'Fee'), stack.pop());
      });

      it("should push txn firstRound to stack", function () {
        const op = new Txn('FirstValid', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(parseToStackElem(TXN_OBJ.fv, 'FirstValid'), stack.pop());
      });

      it("should push txn lastRound to stack", function () {
        const op = new Txn('LastValid', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(parseToStackElem(TXN_OBJ.lv, 'LastValid'), stack.pop());
      });

      it("should push txn sender to stack", function () {
        const op = new Txn('Sender', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.snd, stack.pop());
      });

      it("should push txn type to stack", function () {
        const op = new Txn('Type', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(toBytes(TXN_OBJ.type), stack.pop());
      });

      it("should push txn typeEnum to stack", function () {
        const op = new Txn('TypeEnum', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt('1'), stack.pop());
      });

      it("should push txn lease to stack", function () {
        const op = new Txn('Lease', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.lx, stack.pop());
      });

      it("should push txn note to stack", function () {
        const op = new Txn('Note', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.note, stack.pop());
      });

      it("should push txn rekeyTo addr to stack", function () {
        const op = new Txn('RekeyTo', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.rekey, stack.pop());
      });

      it("should throw error on FirstValidTime",
        execExpectError(
          stack,
          [],
          new Txn('FirstValidTime', interpreter),
          ERRORS.TEAL.LOGIC_REJECTION
        )
      );

      it("should push txn NumAppArgs to stack", function () {
        const op = new Txn('NumAppArgs', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.apaa.length), stack.pop());
      });

      it("should push txn NumAccounts to stack", function () {
        const op = new Txn('NumAccounts', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.apat.length), stack.pop());
      });
    });

    describe("Txn: Payment", function () {
      before(function () {
        interpreter.tx.type = 'pay';
      });

      it("should push txn Receiver to stack", function () {
        const op = new Txn('Receiver', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.rcv, stack.pop());
      });

      it("should push txn Amount to stack", function () {
        const op = new Txn('Amount', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.amt), stack.pop());
      });

      it("should push txn CloseRemainderTo to stack", function () {
        const op = new Txn('CloseRemainderTo', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.close, stack.pop());
      });
    });

    describe("Txn: Key Registration", function () {
      before(function () {
        interpreter.tx.type = 'keyreg';
      });

      it("should push txn VotePK to stack", function () {
        const op = new Txn('VotePK', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.votekey, stack.pop());
      });

      it("should push txn SelectionPK to stack", function () {
        const op = new Txn('SelectionPK', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.selkey, stack.pop());
      });

      it("should push txn VoteFirst to stack", function () {
        const op = new Txn('VoteFirst', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.votefst), stack.pop());
      });

      it("should push txn VoteLast to stack", function () {
        const op = new Txn('VoteLast', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.votelst), stack.pop());
      });

      it("should push txn VoteKeyDilution to stack", function () {
        const op = new Txn('VoteKeyDilution', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.votekd), stack.pop());
      });
    });

    describe("Txn: Asset Configuration Transaction", function () {
      before(function () {
        interpreter.tx.type = 'acfg';
      });

      it("should push txn ConfigAsset to stack", function () {
        const op = new Txn('ConfigAsset', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.caid), stack.pop());
      });

      it("should push txn ConfigAssetTotal to stack", function () {
        const op = new Txn('ConfigAssetTotal', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.apar.t), stack.pop());
      });

      it("should push txn ConfigAssetDecimals to stack", function () {
        const op = new Txn('ConfigAssetDecimals', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.apar.dc), stack.pop());
      });

      it("should push txn ConfigAssetDefaultFrozen to stack", function () {
        const op = new Txn('ConfigAssetDefaultFrozen', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.apar.df), stack.pop());
      });

      it("should push txn ConfigAssetUnitName to stack", function () {
        const op = new Txn('ConfigAssetUnitName', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(toBytes(TXN_OBJ.apar.un), stack.pop());
      });

      it("should push txn ConfigAssetName to stack", function () {
        const op = new Txn('ConfigAssetName', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(toBytes(TXN_OBJ.apar.an), stack.pop());
      });

      it("should push txn ConfigAssetDefaultFrozen to stack", function () {
        const op = new Txn('ConfigAssetURL', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(toBytes(TXN_OBJ.apar.au), stack.pop());
      });

      it("should push txn ConfigAssetMetadataHash to stack", function () {
        const op = new Txn('ConfigAssetMetadataHash', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apar.am, stack.pop());
      });

      it("should push txn ConfigAssetManager to stack", function () {
        const op = new Txn('ConfigAssetManager', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apar.m, stack.pop());
      });

      it("should push txn ConfigAssetReserve to stack", function () {
        const op = new Txn('ConfigAssetReserve', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apar.r, stack.pop());
      });

      it("should push txn ConfigAssetFreeze to stack", function () {
        const op = new Txn('ConfigAssetFreeze', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apar.f, stack.pop());
      });

      it("should push txn ConfigAssetClawback to stack", function () {
        const op = new Txn('ConfigAssetClawback', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apar.c, stack.pop());
      });
    });

    describe("Txn: Asset Transfer Transaction", function () {
      before(function () {
        interpreter.tx.type = 'axfer';
      });

      it("should push txn XferAsset to stack", function () {
        const op = new Txn('XferAsset', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.xaid), stack.pop());
      });

      it("should push txn AssetAmount to stack", function () {
        const op = new Txn('AssetAmount', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.aamt), stack.pop());
      });

      it("should push txn AssetSender to stack", function () {
        const op = new Txn('AssetSender', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.asnd, stack.pop());
      });

      it("should push txn AssetReceiver to stack", function () {
        const op = new Txn('AssetReceiver', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.arcv, stack.pop());
      });

      it("should push txn AssetCloseTo to stack", function () {
        const op = new Txn('AssetCloseTo', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.aclose, stack.pop());
      });
    });

    describe("Txn: Asset Freeze Transaction", function () {
      before(function () {
        interpreter.tx.type = 'afrz';
      });

      it("should push txn FreezeAsset to stack", function () {
        const op = new Txn('FreezeAsset', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.faid), stack.pop());
      });

      it("should push txn FreezeAssetAccount to stack", function () {
        const op = new Txn('FreezeAssetAccount', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.fadd, stack.pop());
      });

      it("should push txn FreezeAssetFrozen to stack", function () {
        const op = new Txn('FreezeAssetFrozen', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.afrz), stack.pop());
      });
    });

    describe("Txn: Application Call Transaction", function () {
      before(function () {
        interpreter.tx.type = 'appl';
      });

      it("should push txn ApplicationID to stack", function () {
        const op = new Txn('ApplicationID', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.apid), stack.pop());
      });

      it("should push txn OnCompletion to stack", function () {
        const op = new Txn('OnCompletion', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt(TXN_OBJ.apan), stack.pop());
      });

      it("should push txn ApprovalProgram to stack", function () {
        const op = new Txn('ApprovalProgram', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apap, stack.pop());
      });

      it("should push txn ClearStateProgram to stack", function () {
        const op = new Txn('ClearStateProgram', interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apsu, stack.pop());
      });
    });

    describe("Gtxn", function () {
      before(function () {
        const tx = interpreter.tx;
        const tx2 = { ...tx, fee: 2222 };
        interpreter.gtxs = [tx, tx2];
      });

      it("push fee from 2nd transaction in group", function () {
        const op = new Gtxn('Fee', 1, interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(BigInt('1000'), stack.pop());
      });
    });

    describe("Txna", function () {
      before(function () {
        interpreter.tx.type = 'pay';
      });

      it("push addr from 2nd account to stack", function () {
        const op = new Txna('Accounts', 1, interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
      });

      it("push addr from 1st AppArg to stack", function () {
        const op = new Txna('ApplicationArgs', 0, interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apaa[0], stack.pop());
      });
    });

    describe("Gtxna", function () {
      before(function () {
        interpreter.tx.type = 'pay';
      });

      it("push addr from 1st account of 2nd Txn in txGrp to stack", function () {
        const op = new Gtxna('Accounts', 1, 0, interpreter);
        op.execute(stack);

        assert.equal(1, stack.length());
        assert.deepEqual(TXN_OBJ.apat[0], stack.pop());
      });

      it("should throw error if field is not an array", function () {
        execExpectError(
          stack,
          [],
          new Gtxna('Fee', 1, 0, interpreter),
          ERRORS.TEAL.INVALID_OP_ARG
        );
      });
    });
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

      const op = new Byte(["base64", base64Str], 1);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });

    it("Byte: should push parsed base32 string as bytes to stack", function () {
      const base32Str = "MFRGGZDFMY======";
      const bytes = new Uint8Array(convertToBuffer(base32Str, EncodingType.BASE32));

      const op = new Byte(["base32", base32Str], 1);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });

    it("Byte: should push parsed hex string as bytes to stack", function () {
      const hexStr = "0x250001000192CD0000002F6D6E742F72";
      const bytes = new Uint8Array(Buffer.from(hexStr.slice(2), 'hex'));

      const op = new Byte([hexStr], 1);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });

    it("Byte: should push string literal as bytes to stack", function () {
      const str = "\"Algorand\"";
      const bytes = new Uint8Array(Buffer.from("Algorand"));

      const op = new Byte([str], 1);
      op.execute(stack);

      assert.equal(1, stack.length());
      assert.deepEqual(bytes, stack.pop());
    });
  });
});
