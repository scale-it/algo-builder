/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable sonarjs/no-duplicate-string */
import { parsing, types } from "@algo-builder/web";
import {
	decodeAddress,
	encodeAddress,
	generateAccount,
	getApplicationAddress,
	signBytes,
} from "algosdk";
import { assert } from "chai";
import { ec as EC } from "elliptic";
import { describe } from "mocha";

import { AccountStore } from "../../../src/account";
import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { getProgram, Runtime } from "../../../src/index";
import { Interpreter } from "../../../src/interpreter/interpreter";
import {
	AcctParamsGet,
	Add,
	Addr,
	Addw,
	And,
	AppGlobalDel,
	AppGlobalGet,
	AppGlobalGetEx,
	AppGlobalPut,
	AppLocalDel,
	AppLocalGet,
	AppLocalGetEx,
	AppLocalPut,
	AppOptedIn,
	AppParamsGet,
	Arg,
	Args,
	Assert,
	Balance,
	Base64Decode,
	BitLen,
	BitwiseAnd,
	BitwiseNot,
	BitwiseOr,
	BitwiseXor,
	Branch,
	BranchIfNotZero,
	BranchIfZero,
	Bsqrt,
	Btoi,
	Byte,
	ByteAdd,
	ByteBitwiseAnd,
	ByteBitwiseInvert,
	ByteBitwiseOr,
	ByteBitwiseXor,
	Bytec,
	Bytecblock,
	ByteDiv,
	ByteEqualTo,
	ByteGreaterThan,
	ByteGreaterThanEqualTo,
	ByteLessThan,
	ByteLessThanEqualTo,
	ByteMod,
	ByteMul,
	ByteNotEqualTo,
	ByteSub,
	ByteZero,
	Concat,
	Cover,
	Dig,
	Div,
	DivModw,
	Divw,
	Dup,
	Dup2,
	EcdsaPkDecompress,
	EcdsaPkRecover,
	EcdsaVerify,
	Ed25519verify,
	EqualTo,
	Err,
	Exp,
	Expw,
	Extract,
	Extract3,
	ExtractUint16,
	ExtractUint32,
	ExtractUint64,
	GetAssetDef,
	GetAssetHolding,
	GetBit,
	GetByte,
	Gitxn,
	Gitxna,
	Gitxnas,
	Gload,
	Gloads,
	Gloadss,
	Global,
	GreaterThan,
	GreaterThanEqualTo,
	Gtxn,
	Gtxna,
	Gtxnas,
	Gtxns,
	Gtxnsa,
	Gtxnsas,
	Int,
	Intc,
	Intcblock,
	Itob,
	ITxn,
	ITxnas,
	Keccak256,
	Label,
	Len,
	LessThan,
	LessThanEqualTo,
	Load,
	Loads,
	Log,
	MinBalance,
	Mod,
	Mul,
	Mulw,
	Not,
	NotEqualTo,
	Or,
	Pragma,
	PushBytes,
	PushInt,
	Replace2,
	Replace3,
	Return,
	Select,
	SetBit,
	SetByte,
	Sha256,
	Sha3_256,
	Sha512_256,
	Shl,
	Shr,
	Sqrt,
	Store,
	Stores,
	Sub,
	Substring,
	Substring3,
	Swap,
	Txn,
	Txna,
	Txnas,
	Uncover,
} from "../../../src/interpreter/opcode-list";
import {
	ALGORAND_ACCOUNT_MIN_BALANCE,
	ASSET_CREATION_FEE,
	DEFAULT_STACK_ELEM,
	MAX_UINT8,
	MAX_UINT64,
	MaxTEALVersion,
	MIN_UINT8,
	ZERO_ADDRESS,
} from "../../../src/lib/constants";
import {
	bigEndianBytesToBigInt,
	bigintToBigEndianBytes,
	convertToBuffer,
	getEncoding,
	strHexToBytes,
} from "../../../src/lib/parsing";
import { Stack } from "../../../src/lib/stack";
import { parseToStackElem } from "../../../src/lib/txn";
import {
	AccountStoreI,
	EncodingType,
	EncTx as EncodedTx,
	SSCAttributesM,
	StackElem,
} from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { execExpectError, expectRuntimeError } from "../../helpers/runtime-errors";
import { accInfo } from "../../mocks/stateful";
import { elonAddr, johnAddr, TXN_OBJ } from "../../mocks/txn";

function setDummyAccInfo(acc: AccountStoreI): void {
	acc.assets = accInfo[0].assets;
	acc.appsLocalState = accInfo[0].appsLocalState;
	acc.appsTotalSchema = accInfo[0].appsTotalSchema;
	acc.createdApps = accInfo[0].createdApps;
	acc.createdAssets = accInfo[0].createdAssets;
}

describe("Teal Opcodes", function () {
	const strArr = ["str1", "str2"].map(parsing.stringToBytes);

	describe("Len", function () {
		const stack = new Stack<StackElem>();

		it("should return correct length of string", function () {
			const str = "HelloWorld";
			stack.push(parsing.stringToBytes(str));
			const op = new Len([], 0);
			op.execute(stack);

			const len = stack.pop();
			assert.equal(len, BigInt(str.length.toString()));
		});

		it("should throw error with uint64", function () {
			stack.push(1000n);
			const op = new Len([], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});
	});

	describe("Pragma", () => {
		const interpreter = new Interpreter();
		const stack = new Stack<StackElem>();
		it("should store pragma version", () => {
			const op = new Pragma(["version", "2"], 1, interpreter);
			assert.equal(op.version, 2);
		});

		it("should store throw length error", () => {
			expectRuntimeError(
				() => new Pragma(["version", "2", "some-value"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.ASSERT_LENGTH
			);
		});
		it("Should return correct cost", () => {
			const op = new Pragma(["version", "3"], 1, interpreter);
			assert.equal(0, op.execute(stack));
		});
	});

	describe("Add", function () {
		const stack = new Stack<StackElem>();

		it("should return correct addition of two unit64", function () {
			stack.push(10n);
			stack.push(20n);
			const op = new Add([], 0);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 30n);
		});

		it(
			"should throw error with Add if stack is below min length",
			execExpectError(stack, [1000n], new Add([], 0), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH)
		);

		it(
			"should throw error if Add is used with strings",
			execExpectError(stack, strArr, new Add([], 0), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);

		it("should throw overflow error with Add", function () {
			stack.push(MAX_UINT64 - 5n);
			stack.push(MAX_UINT64 - 6n);
			const op = new Add([], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW);
		});
	});

	describe("Sub", function () {
		const stack = new Stack<StackElem>();

		it("should return correct subtraction of two unit64", function () {
			stack.push(30n);
			stack.push(20n);
			const op = new Sub([], 0);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 10n);
		});

		it(
			"should throw error with Sub if stack is below min length",
			execExpectError(stack, [1000n], new Sub([], 0), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH)
		);

		it(
			"should throw error if Sub is used with strings",
			execExpectError(stack, strArr, new Sub([], 0), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);

		it("should throw underflow error with Sub if (A - B) < 0", function () {
			stack.push(10n);
			stack.push(20n);
			const op = new Sub([], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_UNDERFLOW);
		});
	});

	describe("Mul", function () {
		const stack = new Stack<StackElem>();

		it("should return correct multiplication of two unit64", function () {
			stack.push(20n);
			stack.push(30n);
			const op = new Mul([], 0);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 600n);
		});

		it(
			"should throw error with Mul if stack is below min length",
			execExpectError(stack, [1000n], new Mul([], 0), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH)
		);

		it(
			"should throw error if Mul is used with strings",
			execExpectError(stack, strArr, new Mul([], 0), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);

		it("should throw overflow error with Mul if (A * B) > max_unit64", function () {
			stack.push(MAX_UINT64 - 5n);
			stack.push(2n);
			const op = new Mul([], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW);
		});
	});

	describe("Div", function () {
		const stack = new Stack<StackElem>();

		it("should return correct division of two unit64", function () {
			stack.push(40n);
			stack.push(20n);
			const op = new Div([], 0);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 2n);
		});

		it("should return 0 on division of two unit64 with A == 0", function () {
			stack.push(0n);
			stack.push(40n);
			const op = new Div([], 0);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 0n);
		});

		it(
			"should throw error with Div if stack is below min length",
			execExpectError(stack, [1000n], new Div([], 0), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH)
		);

		it(
			"should throw error if Div is used with strings",
			execExpectError(stack, strArr, new Div([], 0), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);

		it("should panic on A/B if B == 0", function () {
			stack.push(10n);
			stack.push(0n);
			const op = new Div([], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ZERO_DIV);
		});
	});

	describe("Arg[N]", function () {
		const stack = new Stack<StackElem>();
		let interpreter: Interpreter;
		const args = ["Arg0", "Arg1", "Arg2", "Arg3"].map(parsing.stringToBytes);

		this.beforeAll(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.args = args;
		});

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
			const op = new Arg(["5"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
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
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_ARR_LENGTH);
		});

		it("should load byte block to interpreter bytecblock", function () {
			const interpreter = new Interpreter();
			const bytecblock = ["bytec_0", "bytec_1", "bytec_2", "bytec_3"];
			const op = new Bytecblock(bytecblock, 1, interpreter);
			op.execute(stack);

			const expected: Uint8Array[] = [];
			for (const val of bytecblock) {
				expected.push(parsing.stringToBytes(val));
			}
			assert.deepEqual(expected, interpreter.bytecblock);
		});
	});

	describe("Bytec[N]", function () {
		const stack = new Stack<StackElem>();
		const interpreter = new Interpreter();
		const bytecblock = ["bytec_0", "bytec_1", "bytec_2", "bytec_3"].map(parsing.stringToBytes);
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
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
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
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_ARR_LENGTH);
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
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});
	});

	describe("Mod", function () {
		const stack = new Stack<StackElem>();

		it("should return correct modulo of two unit64", function () {
			stack.push(5n);
			stack.push(2n);
			let op = new Mod([], 1);
			op.execute(stack);

			let top = stack.pop();
			assert.equal(top, 1n);

			stack.push(7n);
			stack.push(7n);
			op = new Mod([], 1);
			op.execute(stack);
			top = stack.pop();
			assert.equal(top, 0n);
		});

		it("should return 0 on modulo of two unit64 with A == 0", function () {
			stack.push(0n);
			stack.push(4n);
			const op = new Mod([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 0n);
		});

		it(
			"should throw error with Mod if stack is below min length",
			execExpectError(stack, [1000n], new Mod([], 1), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH)
		);

		it(
			"should throw error if Mod is used with strings",
			execExpectError(stack, strArr, new Mod([], 1), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);

		it("should panic on A % B if B == 0", function () {
			stack.push(10n);
			stack.push(0n);
			const op = new Mod([], 1);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ZERO_DIV);
		});
	});

	describe("Store", function () {
		let stack: Stack<StackElem>;
		beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should store uint64 to scratch", function () {
			const interpreter = new Interpreter();
			const val = 0n;
			stack.push(val);

			const op = new Store(["0"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.length(), 0); // verify stack is popped
			assert.equal(val, interpreter.scratch[0]);
		});

		it("should store byte[] to scratch", function () {
			const interpreter = new Interpreter();
			const val = parsing.stringToBytes("HelloWorld");
			stack.push(val);

			const op = new Store(["0"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.length(), 0); // verify stack is popped
			assert.equal(val, interpreter.scratch[0]);
		});

		it("should throw error on store if index is out of bound", function () {
			const interpreter = new Interpreter();
			stack.push(0n);

			const op = new Store([(MAX_UINT8 + 5).toString()], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("should throw error on store if stack is empty", function () {
			const interpreter = new Interpreter();
			const stack = new Stack<StackElem>(); // empty stack
			const op = new Store(["0"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("should store uint64 to scratch using `stores`", function () {
			const interpreter = new Interpreter();
			const val = 0n;
			stack.push(0n);
			stack.push(val);

			const op = new Stores([], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.length(), 0); // verify stack is popped
			assert.equal(val, interpreter.scratch[0]);
		});

		it("should store byte[] to scratch using `stores`", function () {
			const interpreter = new Interpreter();
			const val = parsing.stringToBytes("HelloWorld");
			stack.push(0n);
			stack.push(val);

			const op = new Stores([], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.length(), 0); // verify stack is popped
			assert.equal(val, interpreter.scratch[0]);
		});

		it("should throw error on store if index is out of bound using `stores`", function () {
			const interpreter = new Interpreter();
			stack.push(BigInt(MAX_UINT8 + 5));
			stack.push(0n);

			const op = new Stores([], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("should throw error on store if stack is empty using `stores`", function () {
			const interpreter = new Interpreter();
			const stack = new Stack<StackElem>(); // empty stack
			const op = new Stores([], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});
	});

	describe("Bitwise OR", function () {
		const stack = new Stack<StackElem>();

		it("should return correct bitwise-or of two unit64", function () {
			stack.push(10n);
			stack.push(20n);
			const op = new BitwiseOr([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 30n);
		});

		it(
			"should throw error with bitwise-or if stack is below min length",
			execExpectError(
				stack,
				[1000n],
				new BitwiseOr([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it(
			"should throw error if bitwise-or is used with strings",
			execExpectError(stack, strArr, new BitwiseOr([], 1), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);
	});

	describe("Bitwise AND", function () {
		const stack = new Stack<StackElem>();

		it("should return correct bitwise-and of two unit64", function () {
			stack.push(10n);
			stack.push(20n);
			const op = new BitwiseAnd([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 0n);
		});

		it(
			"should throw error with bitwise-and if stack is below min length",
			execExpectError(
				stack,
				[1000n],
				new BitwiseAnd([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it(
			"should throw error if bitwise-and is used with strings",
			execExpectError(stack, strArr, new BitwiseAnd([], 1), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);
	});

	describe("Bitwise XOR", function () {
		const stack = new Stack<StackElem>();

		it("should return correct bitwise-xor of two unit64", function () {
			stack.push(10n);
			stack.push(20n);
			const op = new BitwiseXor([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 30n);
		});

		it(
			"should throw error with bitwise-xor if stack is below min length",
			execExpectError(
				stack,
				[1000n],
				new BitwiseXor([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it(
			"should throw error if bitwise-xor is used with strings",
			execExpectError(stack, strArr, new BitwiseXor([], 1), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);
	});

	describe("Bitwise NOT", function () {
		const stack = new Stack<StackElem>();

		it("should return correct bitwise-not of unit64", function () {
			stack.push(10n);
			const op = new BitwiseNot([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, ~10n);
		});

		it(
			"should throw error with bitwise-not if stack is below min length",
			execExpectError(stack, [], new Add([], 0), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH)
		);

		it(
			"should throw error if bitwise-not is used with string",
			execExpectError(stack, strArr, new BitwiseNot([], 1), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
		);
	});

	describe("Load, Loads(Tealv5)", function () {
		const interpreter = new Interpreter();
		const scratch = [0n, parsing.stringToBytes("HelloWorld")];
		interpreter.scratch = scratch;
		let stack: Stack<StackElem>;

		beforeEach(() => {
			stack = new Stack<StackElem>();
		});

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
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("should load default value to stack if value at a slot is not intialized", function () {
			const interpreter = new Interpreter();
			const op = new Load(["0"], 1, interpreter);
			op.execute(stack);
			assert.equal(DEFAULT_STACK_ELEM, stack.pop());
		});

		it("should load uint64 from scratch space to stack using `loads`", () => {
			stack.push(0n);
			const op = new Loads([], 1, interpreter);

			op.execute(stack);
			assert.equal(interpreter.scratch[0], stack.pop());
		});

		it("should load byte[] from scratch space to stack using `loads`", function () {
			stack.push(1n);
			const op = new Loads([], 1, interpreter);

			op.execute(stack);
			assert.equal(interpreter.scratch[1], stack.pop());
		});

		it("should throw error on load if index is out of bound using `loads`", function () {
			stack.push(BigInt(MAX_UINT8 + 5));
			const op = new Loads([], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("should load default value to stack if value at a slot is not intialized using `loads`", function () {
			const interpreter = new Interpreter();
			stack.push(0n);
			const op = new Loads([], 1, interpreter);
			op.execute(stack);
			assert.equal(DEFAULT_STACK_ELEM, stack.pop());
		});
	});

	describe("Err", function () {
		const stack = new Stack<StackElem>();

		it("should throw TEAL error", function () {
			const op = new Err([], 1);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR);
		});
	});

	describe("Sha256", function () {
		const stack = new Stack<StackElem>();
		const interpreter = new Interpreter();

		it("should return correct hash for Sha256", () => {
			stack.push(parsing.stringToBytes("MESSAGE"));
			const op = new Sha256([], 1, interpreter);
			op.execute(stack);

			const expected = Buffer.from(
				"b194d92018d6074234280c5f5b88649c8db14ef4f2c3746d8a23896a0f6f3b66",
				"hex"
			);

			const top = stack.pop();
			assert.deepEqual(expected, top);
		});

		it(
			"should throw invalid type error sha256",
			execExpectError(
				stack,
				[1n],
				new Sha256([], 1, interpreter),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw error with Sha256 if stack is below min length",
			execExpectError(
				stack,
				[],
				new Sha256([], 1, interpreter),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it("Should return correct cost", () => {
			stack.push(parsing.stringToBytes("MESSAGE"));
			interpreter.tealVersion = 1;
			let op = new Sha256([], 1, interpreter);
			assert.equal(7, op.execute(stack));
			stack.push(parsing.stringToBytes("MESSAGE"));
			interpreter.tealVersion = 2;
			op = new Sha256([], 1, interpreter);
			assert.equal(35, op.execute(stack));
		});
	});

	describe("Sha512_256", function () {
		const stack = new Stack<StackElem>();
		const interpreter = new Interpreter();

		it("should return correct hash for Sha512_256", function () {
			stack.push(parsing.stringToBytes("MESSAGE"));
			const op = new Sha512_256([], 1, interpreter);
			op.execute(stack);

			const expected = Buffer.from(
				"f876dfdffd93791dc919586232116786362d434fe59d06097000fcf42bac228b",
				"hex"
			);

			const top = stack.pop();
			assert.deepEqual(expected, top);
		});

		it(
			"should throw invalid type error sha512_256",
			execExpectError(
				stack,
				[1n],
				new Sha512_256([], 1, interpreter),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw error with Sha512_256 if stack is below min length",
			execExpectError(
				stack,
				[],
				new Sha512_256([], 1, interpreter),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it("Should return correct cost", () => {
			stack.push(parsing.stringToBytes("MESSAGE"));
			interpreter.tealVersion = 1;
			let op = new Sha512_256([], 1, interpreter);
			assert.equal(9, op.execute(stack));
			stack.push(parsing.stringToBytes("MESSAGE"));
			interpreter.tealVersion = 2;
			op = new Sha512_256([], 1, interpreter);
			assert.equal(45, op.execute(stack));
		});
	});

	describe("keccak256", function () {
		const stack = new Stack<StackElem>();
		const interpreter = new Interpreter();

		it("should return correct hash for keccak256", function () {
			stack.push(parsing.stringToBytes("ALGORAND"));
			const op = new Keccak256([], 1, interpreter);
			op.execute(stack);

			// http://emn178.github.io/online-tools/keccak_256.html
			const expected = Buffer.from(
				"ab0d74c2852292002f95c4a64ebd411ecb5e8a599d4bc2cfc1170547c5f44807",
				"hex"
			);

			const top = stack.pop();
			assert.deepEqual(expected, top);
		});

		it(
			"should throw invalid type error Keccak256",
			execExpectError(
				stack,
				[1n],
				new Keccak256([], 1, interpreter),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw error with keccak256 if stack is below min length",
			execExpectError(
				stack,
				[],
				new Keccak256([], 1, interpreter),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it("Should return correct cost", () => {
			stack.push(parsing.stringToBytes("MESSAGE"));
			interpreter.tealVersion = 1;
			let op = new Keccak256([], 1, interpreter);
			assert.equal(26, op.execute(stack));
			stack.push(parsing.stringToBytes("MESSAGE"));
			interpreter.tealVersion = 2;
			op = new Keccak256([], 1, interpreter);
			assert.equal(130, op.execute(stack));
		});
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
			assert.equal(top, 1n);
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
			assert.equal(top, 0n);
		});

		it(
			"should throw invalid type error Ed25519verify",
			execExpectError(
				stack,
				["1", "1", "1"].map(BigInt),
				new Ed25519verify([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw error with Ed25519verify if stack is below min length",
			execExpectError(
				stack,
				[],
				new Ed25519verify([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it("Should return correct cost", () => {
			const account = generateAccount();
			const toSign = new Uint8Array(Buffer.from([1, 9, 25, 49]));
			const signed = signBytes(toSign, account.sk);

			stack.push(toSign); // data
			stack.push(signed); // signature
			stack.push(decodeAddress(account.addr).publicKey); // pk

			const op = new Ed25519verify([], 1);
			assert.equal(1900, op.execute(stack));
		});
	});

	describe("LessThan", function () {
		const stack = new Stack<StackElem>();

		it("should push 1 to stack because 5 < 10", () => {
			stack.push(5n);
			stack.push(10n);

			const op = new LessThan([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 1n);
		});

		it("should push 0 to stack as 10 > 5", () => {
			stack.push(10n);
			stack.push(5n);

			const op = new LessThan([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 0n);
		});

		it(
			"should throw invalid type error LessThan",
			execExpectError(
				stack,
				[new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
				new LessThan([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw stack length error LessThan",
			execExpectError(
				new Stack<StackElem>(),
				[1n],
				new LessThan([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);
	});

	describe("GreaterThan", function () {
		const stack = new Stack<StackElem>();

		it("should push 1 to stack as 5 > 2", () => {
			stack.push(5n);
			stack.push(2n);

			const op = new GreaterThan([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 1n);
		});

		it("should push 0 to stack as 50 > 10", () => {
			stack.push(10n);
			stack.push(50n);

			const op = new GreaterThan([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 0n);
		});

		it(
			"should throw invalid type error GreaterThan",
			execExpectError(
				stack,
				[new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
				new GreaterThan([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw stack length error GreaterThan",
			execExpectError(
				new Stack<StackElem>(),
				[1n],
				new LessThan([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);
	});

	describe("LessThanEqualTo", function () {
		const stack = new Stack<StackElem>();

		it("should push 1 to stack", () => {
			const op = new LessThanEqualTo([], 1);
			stack.push(20n);
			stack.push(20n);

			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 1n);
		});

		it("should push 0 to stack", () => {
			const op = new LessThanEqualTo([], 1);
			stack.push(100n);
			stack.push(50n);

			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 0n);
		});

		it(
			"should throw invalid type error LessThanEqualTo",
			execExpectError(
				stack,
				[new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
				new LessThanEqualTo([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw stack length error LessThanEqualTo",
			execExpectError(
				new Stack<StackElem>(),
				[1n],
				new LessThan([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);
	});

	describe("GreaterThanEqualTo", function () {
		const stack = new Stack<StackElem>();

		it("should push 1 to stack", () => {
			const op = new GreaterThanEqualTo([], 1);
			stack.push(20n);
			stack.push(20n);

			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 1n);
		});

		it("should push 0 to stack", () => {
			const op = new GreaterThanEqualTo([], 1);
			stack.push(100n);
			stack.push(500n);

			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 0n);
		});

		it(
			"should throw invalid type error GreaterThanEqualTo",
			execExpectError(
				stack,
				[new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
				new GreaterThanEqualTo([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw stack length error GreaterThanEqualTo",
			execExpectError(
				new Stack<StackElem>(),
				[1n],
				new LessThan([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);
	});

	describe("And", () => {
		const stack = new Stack<StackElem>();

		it("should push true to stack as both values are 1", () => {
			stack.push(1n);
			stack.push(1n);

			const op = new And([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(1n, top);
		});

		it("should push false to stack as one value is 0", () => {
			stack.push(0n);
			stack.push(1n);

			const op = new And([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(0n, top);
		});

		it(
			"should throw invalid type error (And)",
			execExpectError(
				stack,
				[new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
				new And([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw stack length error (And)",
			execExpectError(
				new Stack<StackElem>(),
				[1n],
				new LessThan([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);
	});

	describe("Or", () => {
		const stack = new Stack<StackElem>();

		it("should push true to stack as one value is 1", () => {
			stack.push(0n);
			stack.push(1n);

			const op = new Or([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(1n, top);
		});

		it("should push false to stack as both values are 0", () => {
			stack.push(0n);
			stack.push(0n);

			const op = new Or([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(0n, top);
		});

		it(
			"should throw invalid type error (Or)",
			execExpectError(
				stack,
				[new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])],
				new Or([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw stack length error (Or)",
			execExpectError(
				new Stack<StackElem>(),
				[1n],
				new LessThan([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);
	});

	describe("EqualTo", () => {
		const stack = new Stack<StackElem>();

		it("should push true to stack", () => {
			stack.push(22n);
			stack.push(22n);

			const op = new EqualTo([], 1);
			op.execute(stack);

			let top = stack.pop();
			assert.equal(1n, top);

			stack.push(new Uint8Array([1, 2, 3]));
			stack.push(new Uint8Array([1, 2, 3]));

			op.execute(stack);
			top = stack.pop();
			assert.equal(1n, top);
		});

		it("should push false to stack", () => {
			stack.push(22n);
			stack.push(1n);

			const op = new EqualTo([], 1);
			op.execute(stack);

			let top = stack.pop();
			assert.equal(0n, top);

			stack.push(new Uint8Array([1, 2, 3]));
			stack.push(new Uint8Array([1, 1, 3]));

			op.execute(stack);
			top = stack.pop();
			assert.equal(0n, top);
		});

		it("should throw error", () => {
			stack.push(12n);
			stack.push(new Uint8Array([1, 2, 3]));
			const op = new EqualTo([], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});
	});

	describe("NotEqualTo", () => {
		const stack = new Stack<StackElem>();

		it("should push true to stack", () => {
			stack.push(21n);
			stack.push(22n);

			const op = new NotEqualTo([], 1);
			op.execute(stack);

			let top = stack.pop();
			assert.equal(1n, top);

			stack.push(new Uint8Array([1, 2, 3]));
			stack.push(new Uint8Array([1, 1, 3]));

			op.execute(stack);
			top = stack.pop();
			assert.equal(1n, top);
		});

		it("should push false to stack", () => {
			stack.push(22n);
			stack.push(22n);

			const op = new NotEqualTo([], 1);
			op.execute(stack);

			let top = stack.pop();
			assert.equal(0n, top);

			stack.push(new Uint8Array([1, 2, 3]));
			stack.push(new Uint8Array([1, 2, 3]));

			op.execute(stack);
			top = stack.pop();
			assert.equal(0n, top);
		});

		it("should throw error", () => {
			stack.push(12n);
			stack.push(new Uint8Array([1, 2, 3]));
			const op = new EqualTo([], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});
	});

	describe("Not", () => {
		const stack = new Stack<StackElem>();

		it("should push 1", () => {
			stack.push(0n);
			const op = new Not([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(1n, top);
		});

		it("should push 0", () => {
			stack.push(122n);
			const op = new Not([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(0n, top);
		});
	});

	describe("itob", () => {
		const stack = new Stack<StackElem>();

		it("should convert int to bytes", () => {
			stack.push(4n);
			const op = new Itob([], 1);
			op.execute(stack);

			const top = stack.pop();
			const expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 4]);
			assert.deepEqual(top, expected);
		});

		it(
			"should throw invalid type error",
			execExpectError(
				stack,
				[new Uint8Array([1, 2])],
				new Itob([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);
	});

	describe("btoi", () => {
		const stack = new Stack<StackElem>();

		it("should convert bytes to int", () => {
			stack.push(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]));
			const op = new Btoi([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(top, 1n);
		});

		it("should throw invalid type error", () => {
			stack.push(new Uint8Array([0, 1, 1, 1, 1, 1, 1, 1, 0]));
			const op = new Btoi([], 1);
			assert.throws(
				() => op.execute(stack),
				"Data has unacceptable length. Expected length is between 1 and 8, got 9"
			);
		});
	});

	describe("Addw", () => {
		const stack = new Stack<StackElem>();

		it("should add carry", () => {
			stack.push(MAX_UINT64);
			stack.push(3n);
			const op = new Addw([], 1);
			op.execute(stack);

			const valueSUM = stack.pop();
			const valueCARRY = stack.pop();
			assert.equal(valueSUM, 2n);
			assert.equal(valueCARRY, 1n);
		});

		it("should not add carry", () => {
			stack.push(10n);
			stack.push(3n);
			const op = new Addw([], 1);
			op.execute(stack);

			const valueSUM = stack.pop();
			const valueCARRY = stack.pop();
			assert.equal(valueSUM, 13n);
			assert.equal(valueCARRY, 0n);
		});
	});

	describe("Mulw", () => {
		const stack = new Stack<StackElem>();

		it("should return correct low and high value", () => {
			stack.push(4581298449n);
			stack.push(9162596898n);
			const op = new Mulw([], 1);
			op.execute(stack);

			const low = stack.pop();
			const high = stack.pop();
			assert.equal(low, 5083102810200507970n);
			assert.equal(high, 2n);
		});

		it("should return correct low and high value on big numbers", () => {
			stack.push(MAX_UINT64 - 2n);
			stack.push(9162596898n);
			const op = new Mulw([], 1);
			op.execute(stack);

			const low = stack.pop();
			const high = stack.pop();
			assert.equal(low, 18446744046221760922n);
			assert.equal(high, 9162596897n);
		});

		it("high bits should be 0", () => {
			stack.push(10n);
			stack.push(3n);
			const op = new Mulw([], 1);
			op.execute(stack);

			const low = stack.pop();
			const high = stack.pop();
			assert.equal(low, 30n);
			assert.equal(high, 0n);
		});

		it("low and high should be 0 on a*b if a or b is 0", () => {
			stack.push(0n);
			stack.push(3n);
			const op = new Mulw([], 1);
			op.execute(stack);

			const low = stack.pop();
			const high = stack.pop();
			assert.equal(low, 0n);
			assert.equal(high, 0n);
		});

		it(
			"should throw stack length error",
			execExpectError(stack, [3n], new Mulw([], 1), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH)
		);

		it(
			"should throw error if type is invalid",
			execExpectError(
				stack,
				["str1", "str2"].map(parsing.stringToBytes),
				new Mulw([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);
	});

	describe("Dup", () => {
		const stack = new Stack<StackElem>();

		it("should duplicate value", () => {
			stack.push(2n);
			const op = new Dup([], 1);
			op.execute(stack);

			const value = stack.pop();
			const dupValue = stack.pop();
			assert.equal(value, 2n);
			assert.equal(dupValue, 2n);
		});
	});

	describe("Dup2", () => {
		const stack = new Stack<StackElem>();

		it("should duplicate value(A, B -> A, B, A, B)", () => {
			stack.push(2n);
			stack.push(3n);
			const op = new Dup2([], 1);
			op.execute(stack);

			const arr = [];
			arr.push(stack.pop());
			arr.push(stack.pop());
			arr.push(stack.pop());
			arr.push(stack.pop());

			assert.deepEqual(arr, ["3", "2", "3", "2"].map(BigInt));
		});

		it(
			"should throw stack length error",
			execExpectError(
				stack,
				[new Uint8Array([1, 2])],
				new Dup2([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);
	});

	describe("Concat", () => {
		const stack = new Stack<StackElem>();

		it("should concat two byte strings", () => {
			stack.push(new Uint8Array([3, 2, 1]));
			stack.push(new Uint8Array([1, 2, 3]));
			let op = new Concat([], 1);
			op.execute(stack);

			let top = stack.pop();
			assert.deepEqual(top, new Uint8Array([3, 2, 1, 1, 2, 3]));

			stack.push(parsing.stringToBytes("Hello"));
			stack.push(parsing.stringToBytes("Friend"));
			op = new Concat([], 1);
			op.execute(stack);

			top = stack.pop();
			assert.deepEqual(top, parsing.stringToBytes("HelloFriend"));
		});

		it("should throw error as byte strings too long", () => {
			stack.push(new Uint8Array(4000));
			stack.push(new Uint8Array(1000));
			const op = new Concat([], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.CONCAT_ERROR);
		});
	});

	describe("Substring", function () {
		const stack = new Stack<StackElem>();
		const start = "0";
		const end = "4";

		it("should return correct substring", function () {
			stack.push(parsing.stringToBytes("Algorand"));
			const op = new Substring([start, end], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.deepEqual(Buffer.from("Algo"), top);
		});

		it(
			"should throw Invalid type error",
			execExpectError(
				stack,
				[1n],
				new Substring([start, end], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it("should throw error if start is not uint8", function () {
			stack.push(parsing.stringToBytes("Algorand"));

			expectRuntimeError(
				() => new Substring([(MIN_UINT8 - 5).toString(), end], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			);

			const op = new Substring([(MAX_UINT8 + 5).toString(), end], 1);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_UINT8);
		});

		it("should throw error if end is not uint8", function () {
			stack.push(parsing.stringToBytes("Algorand"));

			expectRuntimeError(
				() => new Substring([start, (MIN_UINT8 - 5).toString()], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			);

			const op = new Substring([start, (MAX_UINT8 + 5).toString()], 1);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_UINT8);
		});

		it(
			"should throw error because start > end",
			execExpectError(
				stack,
				[parsing.stringToBytes("Algorand")],
				new Substring(["9", end], 1),
				RUNTIME_ERRORS.TEAL.SUBSTRING_END_BEFORE_START
			)
		);

		it(
			"should throw error because range beyong string",
			execExpectError(
				stack,
				[parsing.stringToBytes("Algorand")],
				new Substring([start, "40"], 1),
				RUNTIME_ERRORS.TEAL.SUBSTRING_RANGE_BEYOND
			)
		);
	});

	describe("Substring3", function () {
		const stack = new Stack<StackElem>();

		it("should return correct substring", function () {
			stack.push(parsing.stringToBytes("Algorand"));
			stack.push(0n);
			stack.push(4n);

			const op = new Substring3([], 1);
			op.execute(stack);

			const top = stack.pop();
			assert.deepEqual(Buffer.from("Algo"), top);
		});

		it(
			"should throw Invalid type error",
			execExpectError(
				stack,
				["4", "0", "1234"].map(BigInt),
				new Substring3([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it("should throw error because start > end", function () {
			const end = 4n;
			const start = end + 1n;
			execExpectError(
				stack,
				[parsing.stringToBytes("Algorand"), start, end],
				new Substring3([], 1),
				RUNTIME_ERRORS.TEAL.SUBSTRING_END_BEFORE_START
			);
		});

		it(
			"should throw error because range beyong string",
			execExpectError(
				stack,
				[parsing.stringToBytes("Algorand"), 0n, 40n],
				new Substring3([], 1),
				RUNTIME_ERRORS.TEAL.SUBSTRING_RANGE_BEYOND
			)
		);
	});

	describe("Branch Ops", function () {
		const stack = new Stack<StackElem>();
		const interpreter = new Interpreter();
		const logic = [
			new Int(["1"], 0),
			new Int(["2"], 1),
			new Branch(["dumb"], 2, interpreter),
			new Int(["3"], 3),
			new Label(["dumb:"], 4),
			new Int(["3"], 5),
		];
		interpreter.instructions = logic;

		describe("Branch: unconditional", function () {
			it("should jump unconditionally to branch dump", function () {
				const op = new Branch(["dumb"], 2, interpreter);
				op.execute(stack);
				assert.equal(4, interpreter.instructionIndex);
			});

			it(
				"should throw error if label is not defined",
				execExpectError(
					stack,
					[],
					new Branch(["some-branch-1"], 0, interpreter),
					RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND
				)
			);

			it("should jump to last label if multiple labels have same teal code", function () {
				const stack = new Stack<StackElem>();
				const interpreter = new Interpreter();
				interpreter.instructions = [
					new Int(["1"], 0),
					new Int(["2"], 1),
					new Branch(["label1"], 2, interpreter),
					new Int(["3"], 3),
					new Label(["label1:"], 4),
					new Label(["label2:"], 5),
					new Label(["label3:"], 6),
					new Int(["3"], 7),
				];
				const op = new Branch(["label1"], 2, interpreter);
				op.execute(stack);
				assert.equal(interpreter.instructionIndex, 6);

				// checking for label2, label3 as well
				interpreter.instructionIndex = 0;
				interpreter.instructions[2] = new Branch(["label2"], 2, interpreter);
				op.execute(stack);
				assert.equal(interpreter.instructionIndex, 6);

				interpreter.instructionIndex = 0;
				interpreter.instructions[2] = new Branch(["label3"], 2, interpreter);
				op.execute(stack);
				assert.equal(interpreter.instructionIndex, 6);
			});
		});

		describe("BranchIfZero", function () {
			it("should jump to branch if top of stack is zero", function () {
				interpreter.instructionIndex = 0;

				stack.push(0n);
				const op = new BranchIfZero(["dumb"], 2, interpreter);
				op.execute(stack);
				assert.equal(4, interpreter.instructionIndex);
			});

			it("should not jump to branch if top of stack is not zero", function () {
				interpreter.instructionIndex = 0;

				stack.push(5n);
				const op = new BranchIfZero(["dumb"], 2, interpreter);
				op.execute(stack);
				assert.equal(0, interpreter.instructionIndex);
			});

			it(
				"should throw error if label is not defined for bz",
				execExpectError(
					stack,
					[0n],
					new BranchIfZero(["some-branch-2"], 0, interpreter),
					RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND
				)
			);
		});

		describe("BranchIfNotZero", function () {
			it("should not jump to branch if top of stack is zero", function () {
				interpreter.instructionIndex = 0;

				stack.push(0n);
				const op = new BranchIfNotZero(["dumb"], 2, interpreter);
				op.execute(stack);
				assert.equal(0, interpreter.instructionIndex);
			});

			it("should jump to branch if top of stack is not zero", function () {
				interpreter.instructionIndex = 0;

				stack.push(5n);
				const op = new BranchIfNotZero(["dumb"], 2, interpreter);
				op.execute(stack);
				assert.equal(4, interpreter.instructionIndex);
			});

			it(
				"should throw error if label is not defined for bnz",
				execExpectError(
					stack,
					[5n],
					new BranchIfNotZero(["some-branch-3"], 0, interpreter),
					RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND
				)
			);
		});
	});

	describe("Return", function () {
		const stack = new Stack<StackElem>();
		const interpreter = new Interpreter();

		it("should return by taking last value from stack as success", function () {
			stack.push(1n);
			stack.push(2n);

			const op = new Return([], 0, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(2n, stack.pop());
		});
	});

	describe("Transaction opcodes", function () {
		const stack = new Stack<StackElem>();
		let interpreter: Interpreter;
		before(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.tx = TXN_OBJ;
			interpreter.tealVersion = MaxTEALVersion; // set tealversion to latest (to support all tx fields)
		});

		describe("Txn: Common Fields", function () {
			it("should push txn fee to stack", function () {
				const op = new Txn(["Fee"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(parseToStackElem(TXN_OBJ.fee, "Fee"), stack.pop());
			});

			it("should push txn firstRound to stack", function () {
				const op = new Txn(["FirstValid"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(parseToStackElem(TXN_OBJ.fv, "FirstValid"), stack.pop());
			});

			it("should push txn lastRound to stack", function () {
				const op = new Txn(["LastValid"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(parseToStackElem(TXN_OBJ.lv, "LastValid"), stack.pop());
			});

			it("should push txn sender to stack", function () {
				const op = new Txn(["Sender"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.snd, stack.pop());
			});

			it("should push txn type to stack", function () {
				const op = new Txn(["Type"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(parsing.stringToBytes(TXN_OBJ.type), stack.pop());
			});

			it("should push txn typeEnum to stack", function () {
				const op = new Txn(["TypeEnum"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(1n, stack.pop());
			});

			it("should push txn lease to stack", function () {
				const op = new Txn(["Lease"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.lx, stack.pop());
			});

			it("should push txn note to stack", function () {
				const op = new Txn(["Note"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.note, stack.pop());
			});

			it("should push txn rekeyTo addr to stack", function () {
				const op = new Txn(["RekeyTo"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.rekey, stack.pop());
			});

			it("should throw error on FirstValidTime", () => {
				execExpectError(
					stack,
					[],
					new Txn(["FirstValidTime"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
				);
			});

			it("should push txn NumAppArgs to stack", function () {
				const op = new Txn(["NumAppArgs"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apaa.length), stack.pop());
			});

			it("should push txn NumAccounts to stack", function () {
				const op = new Txn(["NumAccounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apat.length), stack.pop());
			});
		});

		describe("Txn: Payment", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "pay";
			});

			it("should push txn Receiver to stack", function () {
				const op = new Txn(["Receiver"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.rcv, stack.pop());
			});

			it("should push txn Amount to stack", function () {
				const op = new Txn(["Amount"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.amt), stack.pop());
			});

			it("should push txn CloseRemainderTo to stack", function () {
				const op = new Txn(["CloseRemainderTo"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.close, stack.pop());
			});
		});

		describe("Txn: Key Registration", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "keyreg";
			});

			it("should push txn VotePK to stack", function () {
				const op = new Txn(["VotePK"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.votekey, stack.pop());
			});

			it("should push txn SelectionPK to stack", function () {
				const op = new Txn(["SelectionPK"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.selkey, stack.pop());
			});

			it("should push txn VoteFirst to stack", function () {
				const op = new Txn(["VoteFirst"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.votefst), stack.pop());
			});

			it("should push txn VoteLast to stack", function () {
				const op = new Txn(["VoteLast"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.votelst), stack.pop());
			});

			it("should push txn VoteKeyDilution to stack", function () {
				const op = new Txn(["VoteKeyDilution"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.votekd), stack.pop());
			});
		});

		describe("Txn: Asset Configuration Transaction", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "acfg";
			});

			it("should push txn ConfigAsset to stack", function () {
				const op = new Txn(["ConfigAsset"], 1, interpreter); // ConfigAsset
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.caid), stack.pop());
			});

			it("should push txn ConfigAssetTotal to stack", function () {
				const op = new Txn(["ConfigAssetTotal"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apar.t), stack.pop());
			});

			it("should push txn ConfigAssetDecimals to stack", function () {
				const op = new Txn(["ConfigAssetDecimals"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apar.dc), stack.pop());
			});

			it("should push txn ConfigAssetDefaultFrozen to stack", function () {
				const op = new Txn(["ConfigAssetDefaultFrozen"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apar.df), stack.pop());
			});

			it("should push txn ConfigAssetUnitName to stack", function () {
				const op = new Txn(["ConfigAssetUnitName"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(parsing.stringToBytes(TXN_OBJ.apar.un), stack.pop());
			});

			it("should push txn ConfigAssetName to stack", function () {
				const op = new Txn(["ConfigAssetName"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(parsing.stringToBytes(TXN_OBJ.apar.an), stack.pop());
			});

			it("should push txn ConfigAssetURL to stack", function () {
				const op = new Txn(["ConfigAssetURL"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(parsing.stringToBytes(TXN_OBJ.apar.au), stack.pop());
			});

			it("should push txn ConfigAssetMetadataHash to stack", function () {
				const op = new Txn(["ConfigAssetMetadataHash"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apar.am, stack.pop());
			});

			it("should push txn ConfigAssetManager to stack", function () {
				const op = new Txn(["ConfigAssetManager"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apar.m, stack.pop());
			});

			it("should push txn ConfigAssetReserve to stack", function () {
				const op = new Txn(["ConfigAssetReserve"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apar.r, stack.pop());
			});

			it("should push txn ConfigAssetFreeze to stack", function () {
				const op = new Txn(["ConfigAssetFreeze"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apar.f, stack.pop());
			});

			it("should push txn ConfigAssetClawback to stack", function () {
				const op = new Txn(["ConfigAssetClawback"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apar.c, stack.pop());
			});
		});

		describe("Txn: Asset Transfer Transaction", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "axfer";
			});

			it("should push txn XferAsset to stack", function () {
				const op = new Txn(["XferAsset"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.xaid), stack.pop());
			});

			it("should push txn AssetAmount to stack", function () {
				const op = new Txn(["AssetAmount"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.aamt), stack.pop());
			});

			it("should push txn AssetSender to stack", function () {
				const op = new Txn(["AssetSender"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(ZERO_ADDRESS, stack.pop());
			});

			it("should push txn AssetReceiver to stack", function () {
				const op = new Txn(["AssetReceiver"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.arcv, stack.pop());
			});

			it("should push txn AssetCloseTo to stack", function () {
				const op = new Txn(["AssetCloseTo"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.aclose, stack.pop());
			});
		});

		describe("Txn: Asset Freeze Transaction", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "afrz";
			});

			it("should push txn FreezeAsset to stack", function () {
				const op = new Txn(["FreezeAsset"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.faid), stack.pop());
			});

			it("should push txn FreezeAssetAccount to stack", function () {
				const op = new Txn(["FreezeAssetAccount"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.fadd, stack.pop());
			});

			it("should push txn FreezeAssetFrozen to stack", function () {
				const op = new Txn(["FreezeAssetFrozen"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.afrz), stack.pop());
			});
		});

		describe("Txn: Application Call Transaction", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "appl";
				interpreter.runtime.ctx.tx.apid = 1847;
			});

			it("should push txn ApplicationID to stack", function () {
				const op = new Txn(["ApplicationID"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apid), stack.pop());
			});

			it("should push txn OnCompletion to stack", function () {
				const op = new Txn(["OnCompletion"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apan), stack.pop());
			});

			it("should push txn ApprovalProgram to stack", function () {
				const op = new Txn(["ApprovalProgram"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apap, stack.pop());
			});

			it("should push txn ClearStateProgram to stack", function () {
				const op = new Txn(["ClearStateProgram"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apsu, stack.pop());
			});

			it("should push value from accounts or args array by index", function () {
				let op = new Txn(["Accounts", "0"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.tx.snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				op = new Txn(["Accounts", "1"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				op = new Txn(["Accounts", "2"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());

				op = new Txn(["ApplicationArgs", "0"], 0, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apaa[0], stack.pop());
			});

			// introduced in TEALv3
			it("should push value from foreign assets array and push NumAssets", function () {
				// should push Accounts[0] to stack
				let op = new Txn(["Assets", "0"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apas[0]), stack.pop());

				// should push Accounts[1] to stack
				op = new Txn(["Assets", "1"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apas[1]), stack.pop());

				// index 10 should be out_of_bound
				op = new Txn(["Assets", "10"], 1, interpreter);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);

				op = new Txn(["NumAssets"], 1, interpreter);
				op.execute(stack);
				assert.equal(BigInt(TXN_OBJ.apas.length), stack.pop());
			});

			it("should push value from foreign applications array and push NumApplications", function () {
				// special case: Txn.Applications[0] represents current_applications_id
				let op = new Txn(["Applications", "0"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apid), stack.pop());

				// Txn.Applications[1] should push "1st" app_id from foreign Apps (Txn.ForeignApps[0])
				op = new Txn(["Applications", "1"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apfa[0]), stack.pop());

				// index 10 should be out_of_bound
				op = new Txn(["Applications", "10"], 1, interpreter);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);

				op = new Txn(["NumApplications"], 1, interpreter);
				op.execute(stack);
				assert.equal(BigInt(TXN_OBJ.apfa.length), stack.pop());
			});

			it("should push local, global uint and byte slices from state schema to stack", function () {
				let op = new Txn(["GlobalNumUint"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apgs.nui), stack.pop());

				op = new Txn(["GlobalNumByteSlice"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apgs.nbs), stack.pop());

				op = new Txn(["LocalNumUint"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apls.nui), stack.pop());

				op = new Txn(["LocalNumByteSlice"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apls.nbs), stack.pop());
			});

			// introduced in TEALv4
			it("should push extra program pages to stack", function () {
				const op = new Txn(["ExtraProgramPages"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.apep), stack.pop());
			});

			// introduced in TEALv5
			it("should push txn.nonparticipation key to stack", function () {
				const op = new Txn(["Nonparticipation"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.equal(BigInt(TXN_OBJ.nonpart), stack.pop());
			});
		});

		describe("Txn: teal v6", function () {
			it("should return empty log if no log emit before", () => {
				const op = new Txn(["LastLog"], 1, interpreter);
				op.execute(stack);
				assert.deepEqual(stack.pop(), new Uint8Array(0));
			});
			it("should return last log", () => {
				interpreter.runtime.ctx.lastLog = new Uint8Array([42, 32]);
				const op = new Txn(["LastLog"], 1, interpreter);
				op.execute(stack);
				assert.deepEqual(stack.pop(), new Uint8Array([42, 32]));
			});

			it("should return StateProofPK", () => {
				const op = new Txn(["StateProofPK"], 1, interpreter);
				op.execute(stack);
				assert.deepEqual(stack.pop(), new Uint8Array(64).fill(0));
			});
		});

		describe("Gtxn", function () {
			before(function () {
				const tx = interpreter.runtime.ctx.tx;
				// a) 'apas' represents 'foreignAssets', b)
				// 'apfa' represents 'foreignApps' (id's of foreign apps)
				// https://developer.algorand.org/docs/reference/transactions/
				const tx2 = { ...tx, fee: 2222, apas: [3033, 4044], apfa: [5005, 6006, 7077] };
				interpreter.runtime.ctx.gtxs = [tx, tx2];
			});

			it("push fee from 2nd transaction in group", function () {
				const op = new Gtxn(["1", "Fee"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(2222n, stack.pop());
			});

			it("should push value from accounts or args array by index from tx group", function () {
				let op = new Gtxn(["1", "Accounts", "0"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.tx.snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				op = new Gtxn(["1", "Accounts", "1"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				op = new Gtxn(["1", "Accounts", "2"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());

				op = new Gtxn(["1", "ApplicationArgs", "0"], 0, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apaa[0], stack.pop());
			});

			it("should push value from assets or applications array by index from tx group", function () {
				let op = new Gtxn(["1", "Assets", "0"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(3033n, stack.pop()); // first asset from 2nd tx in group

				op = new Gtxn(["0", "Assets", "0"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(BigInt(TXN_OBJ.apas[0]), stack.pop()); // first asset from 1st tx

				op = new Gtxn(["1", "NumAssets"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(2n, stack.pop());

				op = new Gtxn(["1", "NumApplications"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(3n, stack.pop());

				// index 0 represent tx.apid (current application id)
				op = new Gtxn(["1", "Applications", "0"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(BigInt(interpreter.runtime.ctx.tx.apid as number), stack.pop());

				op = new Gtxn(["0", "Applications", "2"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(BigInt(TXN_OBJ.apfa[1]), stack.pop());
			});
		});

		describe("Gitxn", function () {
			before(function () {
				const tx = interpreter.runtime.ctx.tx;
				// a) 'apas' represents 'foreignAssets', b)
				// 'apfa' represents 'foreignApps' (id's of foreign apps)
				// https://developer.algorand.org/docs/reference/transactions/
				const tx2 = { ...tx, fee: 2222, apas: [3033, 4044], apfa: [5005, 6006, 7077] };
				interpreter.innerTxnGroups = [[tx, tx2]];
			});

			it("Should push fee from 2nd transaction in group", function () {
				const op = new Gitxn(["1", "Fee"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.equal(2222n, stack.pop());
			});

			it("Should push value from accounts or args array by index from tx group", function () {
				let op = new Gitxn(["1", "Accounts", "0"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.tx.snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				op = new Gitxn(["1", "Accounts", "1"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				op = new Gitxn(["1", "Accounts", "2"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());

				op = new Gitxn(["1", "ApplicationArgs", "0"], 0, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apaa[0], stack.pop());
			});

			it("Should push value from assets or applications array by index from tx group", function () {
				let op = new Gitxn(["1", "Assets", "0"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(3033n, stack.pop()); // first asset from 2nd tx in group

				op = new Gitxn(["0", "Assets", "0"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(BigInt(TXN_OBJ.apas[0]), stack.pop()); // first asset from 1st tx

				op = new Gitxn(["1", "NumAssets"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(2n, stack.pop());

				op = new Gitxn(["1", "NumApplications"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(3n, stack.pop());

				// index 0 represent tx.apid (current application id)
				op = new Gitxn(["1", "Applications", "0"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(BigInt(interpreter.runtime.ctx.tx.apid as number), stack.pop());

				op = new Gitxn(["0", "Applications", "2"], 1, interpreter);
				op.execute(stack);
				assert.equal(1, stack.length());
				assert.deepEqual(BigInt(TXN_OBJ.apfa[1]), stack.pop());
			});
		});

		describe("Txna", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "pay";
			});

			it("push addr from txn.Accounts to stack according to index", function () {
				// index 0 should push sender's address to stack
				let op = new Txna(["Accounts", "0"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.tx.snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				op = new Txna(["Accounts", "1"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				op = new Txna(["Accounts", "2"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
			});

			it("push addr from 1st AppArg to stack", function () {
				const op = new Txna(["ApplicationArgs", "0"], 0, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apaa[0], stack.pop());
			});
		});

		describe("Gtxna", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "pay";
			});

			it("push addr from 1st account of 2nd Txn in txGrp to stack", function () {
				// index 0 should push sender's address to stack from 1st tx
				let op = new Gtxna(["0", "Accounts", "1"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.gtxs[0].snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				op = new Gtxna(["0", "Accounts", "1"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				op = new Gtxna(["0", "Accounts", "2"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
			});

			it("should throw error if field is not an array", function () {
				execExpectError(
					stack,
					[],
					new Gtxna(["1", "Accounts", "0"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
				);
			});
		});

		describe("Tx fields for specific version", function () {
			it("should throw error if transaction field is not present in teal version", function () {
				interpreter.tealVersion = 1;

				// for txn
				expectRuntimeError(
					() => new Txn(["ApplicationID"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				expectRuntimeError(
					() => new Txn(["ApprovalProgram"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				expectRuntimeError(
					() => new Txn(["ConfigAssetDecimals"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				expectRuntimeError(
					() => new Txn(["FreezeAssetAccount"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				expectRuntimeError(
					() => new Txn(["FreezeAssetAccount"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				// for gtxn
				expectRuntimeError(
					() => new Gtxn(["0", "OnCompletion"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				expectRuntimeError(
					() => new Gtxn(["0", "RekeyTo"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);

				expectRuntimeError(
					() => new Gtxn(["0", "ConfigAssetClawback"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_TRANSACTION_FIELD
				);
			});
		});

		describe("Gitxna", function () {
			this.beforeEach(() => {
				interpreter.tealVersion = 6;
				const tx = interpreter.runtime.ctx.tx;
				// a) 'apas' represents 'foreignAssets', b)
				// 'apfa' represents 'foreignApps' (id's of foreign apps)
				// https://developer.algorand.org/docs/reference/transactions/
				const tx2 = { ...tx, fee: 2222, apas: [3033, 4044], apfa: [5005, 6006, 7077] };
				interpreter.innerTxnGroups = [[tx, tx2]];
			});

			it("Should push addr from 1st account of 2nd Txn in txGrp to stack", function () {
				// index 0 should push sender's address to stack from 1st tx
				let op = new Gitxna(["0", "Accounts", "1"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.gtxs[0].snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				op = new Gitxna(["0", "Accounts", "1"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				op = new Gitxna(["0", "Accounts", "2"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
			});

			it("Should throw an error if field is not an array", function () {
				execExpectError(
					stack,
					[],
					new Gitxna(["1", "Accounts", "0"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
				);
			});
		});

		describe("Gtxnas", function () {
			it("Should push addr from 1st account of 2nd Txn in txGrp to stack", function () {
				// index 0 should push sender's address to stack from 1st tx
				stack.push(0n);
				let op = new Gitxnas(["0", "Accounts"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.gtxs[0].snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				stack.push(1n);
				op = new Gitxnas(["0", "Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				stack.push(2n);
				op = new Gitxnas(["0", "Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
			});

			it("should throw error if field is not an array", function () {
				stack.push(0n);
				execExpectError(
					stack,
					[],
					new Gitxnas(["1", "Accounts"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
				);
			});
		});
	});

	describe("Global Opcode", function () {
		const stack = new Stack<StackElem>();
		let interpreter: Interpreter;

		// setup 1st account (to be used as sender)
		const acc1: AccountStoreI = new AccountStore(123, {
			addr: elonAddr,
			sk: new Uint8Array(0),
		}); // setup test account
		setDummyAccInfo(acc1);

		before(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([acc1]);
			interpreter.runtime.ctx.tx = TXN_OBJ;
			interpreter.runtime.ctx.gtxs = [TXN_OBJ];
			interpreter.runtime.ctx.tx.apid = 1828;
			interpreter.tealVersion = MaxTEALVersion; // set tealversion to latest (to support all global fields)
		});

		it("should push MinTxnFee to stack", function () {
			const op = new Global(["MinTxnFee"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(1000n, top);
		});

		it("should push MinBalance to stack", function () {
			const op = new Global(["MinBalance"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(10000n, top);
		});

		it("should push MaxTxnLife to stack", function () {
			const op = new Global(["MaxTxnLife"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(1000n, top);
		});

		it("should push ZeroAddress to stack", function () {
			const op = new Global(["ZeroAddress"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.deepEqual(new Uint8Array(32), top);
		});

		it("should push GroupSize to stack", function () {
			const op = new Global(["GroupSize"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(BigInt(interpreter.runtime.ctx.gtxs.length), top);
		});

		it("should push LogicSigVersion to stack", function () {
			const op = new Global(["LogicSigVersion"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(BigInt(MaxTEALVersion), top);
		});

		it("should push Round to stack", function () {
			interpreter.runtime.setRoundAndTimestamp(500, 1);
			const op = new Global(["Round"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(500n, top);
		});

		it("should push LatestTimestamp to stack", function () {
			interpreter.runtime.setRoundAndTimestamp(500, 100);
			const op = new Global(["LatestTimestamp"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(100n, top);
		});

		it("should push CurrentApplicationID to stack", function () {
			const op = new Global(["CurrentApplicationID"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			assert.equal(1828n, top);
		});

		it("should push CreatorAddress to stack", function () {
			const op = new Global(["CreatorAddress"], 1, interpreter);
			op.execute(stack);

			// creator of app (id = 1848) is set as elonAddr in ../mock/stateful
			assert.deepEqual(decodeAddress(elonAddr).publicKey, stack.pop());
		});

		it("TEALv5: should push GroupID to stack", function () {
			const op = new Global(["GroupID"], 1, interpreter);
			op.execute(stack);

			assert.deepEqual(Uint8Array.from(TXN_OBJ.grp), stack.pop());
		});

		it("TEALv5: should push zero 32 bytes to stack if global.groupID not found", function () {
			(TXN_OBJ.grp as any) = undefined;
			const op = new Global(["GroupID"], 1, interpreter);
			op.execute(stack);

			assert.deepEqual(ZERO_ADDRESS, stack.pop());
		});

		describe("Tealv6 fields", function () {
			this.beforeEach(() => {
				interpreter.tealVersion = 6;
				interpreter.runtime.ctx.innerTxAppIDCallStack = [1, 2];
			});
			it("Tealv6: CalllerApplicationAddress", () => {
				// caller app id = 2
				const op = new Global(["CallerApplicationAddress"], 1, interpreter);
				op.execute(stack);
				assert.deepEqual(decodeAddress(getApplicationAddress(2n)).publicKey, stack.pop());

				// no caller
				interpreter.runtime.ctx.innerTxAppIDCallStack = [];
				op.execute(stack);
				assert.deepEqual(ZERO_ADDRESS, stack.pop());
			});

			it("Tealv6: CallerApplicationID", () => {
				// caller app id = 2
				const op = new Global(["CallerApplicationID"], 1, interpreter);
				op.execute(stack);
				assert.equal(2n, stack.pop());

				// no caller
				interpreter.runtime.ctx.innerTxAppIDCallStack = [];
				op.execute(stack);
				assert.equal(0n, stack.pop());
			});
		});

		it("should throw error if global field is not present in teal version", function () {
			interpreter.tealVersion = 1;

			expectRuntimeError(
				() => new Global(["LogicSigVersion"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			expectRuntimeError(
				() => new Global(["Round"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			expectRuntimeError(
				() => new Global(["LatestTimestamp"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			expectRuntimeError(
				() => new Global(["CurrentApplicationID"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			interpreter.tealVersion = 2;
			expectRuntimeError(
				() => new Global(["CreatorAddress"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			interpreter.tealVersion = 4;
			expectRuntimeError(
				() => new Global(["GroupID"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);

			interpreter.tealVersion = 5;
			expectRuntimeError(
				() => new Global(["CallerApplicationID"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);
			expectRuntimeError(
				() => new Global(["CallerApplicationAddress"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_GLOBAL_FIELD
			);
		});
	});

	describe("StateFul Opcodes", function () {
		const stack = new Stack<StackElem>();
		const lineNumber = 0;
		const elonPk = decodeAddress(elonAddr).publicKey;

		// setup 1st account (to be used as sender)
		const acc1: AccountStoreI = new AccountStore(123, {
			addr: elonAddr,
			sk: new Uint8Array(0),
		}); // setup test account
		setDummyAccInfo(acc1);

		// setup 2nd account (to be used as Txn.Accounts[A])
		const acc2 = new AccountStore(123, { addr: johnAddr, sk: new Uint8Array(0) });
		setDummyAccInfo(acc2);

		let interpreter: Interpreter;
		this.beforeAll(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([acc1, acc2]);

			// setting txn object and sender's addr
			interpreter.runtime.ctx.tx = {
				...TXN_OBJ,
				snd: Buffer.from(elonPk),
			};
		});

		describe("AppOptedIn", function () {
			it("should push 1 to stack if app is opted in", function () {
				// for Sender
				stack.push(0n);
				stack.push(1847n);

				let op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);

				let top = stack.pop();
				assert.equal(1n, top);

				// for Txn.Accounts[A]
				stack.push(1n);
				stack.push(1847n);

				op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);

				top = stack.pop();
				assert.equal(1n, top);
			});

			it("should push 0 to stack if app is not opted in", function () {
				// for Sender
				stack.push(0n);
				stack.push(1111n);

				let op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);

				let top = stack.pop();
				assert.equal(0n, top);

				// for Txn.Accounts[A]
				stack.push(1n);
				stack.push(1111n);

				op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);

				top = stack.pop();
				assert.equal(0n, top);
			});

			it("should throw error if address is passed directly with teal version < 4", function () {
				execExpectError(
					stack,
					[elonPk, 1111n], // passing elonPk directly should throw error
					new AppOptedIn([], 1, interpreter),
					RUNTIME_ERRORS.TEAL.PRAGMA_VERSION_ERROR
				);
			});

			it("should push 0 to stack if offset to foreign apps is passed with teal version < 4", function () {
				stack.push(0n);
				stack.push(2n); // offset (but in prior version, this is treated as appIndex directly)

				const op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);
				assert.equal(0n, stack.pop());
			});

			it("tealv4: should push expected value to stack if address is passed directly", function () {
				interpreter.tealVersion = 4;
				interpreter.runtime.ctx.tx.apid = 1847; // set txn.ApplicationID

				// elonPk is the Txn.Sender
				stack.push(elonPk);
				stack.push(1847n);

				let op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);
				assert.equal(1n, stack.pop());

				// johnAddr is present in Txn.Accounts, so we can pass it directly
				stack.push(decodeAddress(johnAddr).publicKey);
				stack.push(1847n);
				op = new AppOptedIn([], 1, interpreter);
				assert.doesNotThrow(() => op.execute(stack));
			});

			it("tealv4: should push expected value to stack if app offset is passed directly", function () {
				stack.push(0n);
				stack.push(0n); // 0 offset means current_app_id
				let op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);
				assert.equal(1n, stack.pop());

				interpreter.runtime.ctx.tx.apfa = [11, 1847];
				stack.push(0n);
				stack.push(2n); // should push 2nd app_id from Txn.ForeignApps (with TEALv4)
				op = new AppOptedIn([], 1, interpreter);
				op.execute(stack);
				assert.equal(1n, stack.pop());
			});

			it("tealv4: should throw error if address is passed directly but not present in Txn.Accounts[]", function () {
				// should throw error as this address is not present in Txn.Accounts[]
				stack.push(decodeAddress(generateAccount().addr).publicKey); // randomPk
				stack.push(1847n);

				const op = new AppOptedIn([], 1, interpreter);
				expectRuntimeError(
					() => op.execute(stack),
					RUNTIME_ERRORS.TEAL.ADDR_NOT_FOUND_IN_TXN_ACCOUNT
				);
			});
		});

		describe("AppLocalGet", function () {
			before(function () {
				interpreter.tealVersion = 3;
				interpreter.runtime.ctx.tx.apid = 1847;
			});

			it("should push the value to stack if key is present in local state", function () {
				// for Sender
				stack.push(0n);
				stack.push(parsing.stringToBytes("Local-key"));

				let op = new AppLocalGet([], 1, interpreter);
				op.execute(stack);

				let top = stack.pop();
				assert.deepEqual(parsing.stringToBytes("Local-val"), top);

				// for Txn.Accounts[A]
				stack.push(1n);
				stack.push(parsing.stringToBytes("Local-key"));

				op = new AppLocalGet([], 1, interpreter);
				op.execute(stack);

				top = stack.pop();
				assert.deepEqual(parsing.stringToBytes("Local-val"), top);
			});

			it("should push uint 0 to stack if key is not present in local state", function () {
				// for Sender
				stack.push(0n);
				stack.push(parsing.stringToBytes("random-key"));

				let op = new AppLocalGet([], 1, interpreter);
				op.execute(stack);

				let top = stack.pop();
				assert.equal(0n, top);

				// for Txn.Accounts[A]
				stack.push(1n);
				stack.push(parsing.stringToBytes("random-key"));

				op = new AppLocalGet([], 1, interpreter);
				op.execute(stack);

				top = stack.pop();
				assert.equal(0n, top);
			});

			it("tealv4: should accept address directly for app_local_get", function () {
				interpreter.tealVersion = 4;

				// for Sender
				stack.push(elonPk);
				stack.push(parsing.stringToBytes("random-key"));
				let op = new AppLocalGet([], 1, interpreter);
				op.execute(stack);
				assert.equal(0n, stack.pop());

				// for Txn.Accounts[A]
				stack.push(decodeAddress(johnAddr).publicKey);
				stack.push(parsing.stringToBytes("random-key"));
				op = new AppLocalGet([], 1, interpreter);
				op.execute(stack);
				assert.equal(0n, stack.pop());

				// random address (not present in accounts should throw error)
				stack.push(decodeAddress(generateAccount().addr).publicKey); // randomPk
				stack.push(1847n);
				op = new AppOptedIn([], 1, interpreter);
				expectRuntimeError(
					() => op.execute(stack),
					RUNTIME_ERRORS.TEAL.ADDR_NOT_FOUND_IN_TXN_ACCOUNT
				);
			});
		});

		describe("AppLocalGetEx", function () {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1847;
			});

			it("should push the value to stack if key is present in local state from given appID", function () {
				// for Sender
				stack.push(0n);
				stack.push(1847n);
				stack.push(parsing.stringToBytes("Local-key"));

				let op = new AppLocalGetEx([], 1, interpreter);
				op.execute(stack);

				let flag = stack.pop();
				let value = stack.pop();
				assert.equal(1n, flag);
				assert.deepEqual(parsing.stringToBytes("Local-val"), value);

				// for Txn.Accounts[A]
				stack.push(1n);
				stack.push(1847n);
				stack.push(parsing.stringToBytes("Local-key"));

				op = new AppLocalGetEx([], 1, interpreter);
				op.execute(stack);

				flag = stack.pop();
				value = stack.pop();
				assert.equal(1n, flag);
				assert.deepEqual(parsing.stringToBytes("Local-val"), value);
			});

			it("should push uint 0 to stack if key is not present in local state from given appID", function () {
				// for Sender
				stack.push(0n);
				stack.push(1847n);
				stack.push(parsing.stringToBytes("random-key"));

				let op = new AppLocalGetEx([], 1, interpreter);
				op.execute(stack);

				let didExistFlag = stack.pop();
				let val = stack.pop();
				assert.equal(0n, didExistFlag);
				assert.equal(0n, val);

				// for Txn.Accounts[A]
				stack.push(1n);
				stack.push(1847n);
				stack.push(parsing.stringToBytes("random-key"));

				op = new AppLocalGetEx([], 1, interpreter);
				op.execute(stack);

				didExistFlag = stack.pop();
				val = stack.pop();
				assert.equal(0n, didExistFlag);
				assert.equal(0n, val);
			});
		});

		describe("AppGlobalGet", function () {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1828;
				interpreter.runtime.ctx.tx.apfa = TXN_OBJ.apfa;
			});

			it("should push the value to stack if key is present in global state", function () {
				stack.push(parsing.stringToBytes("global-key"));

				const op = new AppGlobalGet([], 1, interpreter);
				op.execute(stack);

				const top = stack.pop();
				assert.deepEqual(parsing.stringToBytes("global-val"), top);
			});

			it("should push uint 0 to stack if key is not present in global state", function () {
				stack.push(parsing.stringToBytes("random-key"));

				const op = new AppGlobalGet([], 1, interpreter);
				op.execute(stack);

				const top = stack.pop();
				assert.equal(0n, top);
			});
		});

		describe("AppGlobalGetEx", function () {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1828;
			});

			it("should push the value to stack if key is present externally in global state", function () {
				// zero index means current app
				stack.push(0n);
				stack.push(parsing.stringToBytes("Hello"));

				let op = new AppGlobalGetEx([], 1, interpreter);
				op.execute(stack);

				let flag = stack.pop();
				let value = stack.pop();
				assert.equal(1n, flag);
				assert.deepEqual(parsing.stringToBytes("World"), value);

				// for Txn.ForeignApps[A]
				stack.push(1n);
				stack.push(parsing.stringToBytes("global-key"));

				op = new AppGlobalGetEx([], 1, interpreter);
				op.execute(stack);

				flag = stack.pop();
				value = stack.pop();
				assert.equal(1n, flag);
				assert.deepEqual(parsing.stringToBytes("global-val"), value);
			});

			it("should push uint 0 to stack if key is not present externally in global state", function () {
				// zero index means current app
				stack.push(0n);
				stack.push(parsing.stringToBytes("random-key"));

				let op = new AppGlobalGetEx([], 1, interpreter);
				op.execute(stack);

				let didExistFlag = stack.pop();
				let val = stack.pop();
				assert.equal(0n, didExistFlag);
				assert.equal(0n, val);

				// for Txn.ForeignApps[A]
				stack.push(1n);
				stack.push(parsing.stringToBytes("random-key"));

				op = new AppGlobalGetEx([], 1, interpreter);
				op.execute(stack);

				didExistFlag = stack.pop();
				val = stack.pop();
				assert.equal(0n, didExistFlag);
				assert.equal(0n, val);
			});
		});

		describe("AppLocalPut", function () {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1847;
			});

			it("should put the value in account's local storage", function () {
				let value;
				// for Sender, check for byte
				stack.push(0n);
				stack.push(parsing.stringToBytes("New-Key"));
				stack.push(parsing.stringToBytes("New-Val"));

				let op = new AppLocalPut([], 1, interpreter);
				op.execute(stack);

				const appID = interpreter.runtime.ctx.tx.apid as number;
				const acc = interpreter.runtime.ctx.state.accounts.get(elonAddr);

				value = acc?.getLocalState(appID, "New-Key");
				assert.isDefined(value);
				assert.deepEqual(value, parsing.stringToBytes("New-Val"));

				// for Txn.Accounts[A], uint
				stack.push(1n);
				stack.push(parsing.stringToBytes("New-Key-1"));
				stack.push(2222n);

				op = new AppLocalPut([], 1, interpreter);
				op.execute(stack);

				value = acc?.getLocalState(appID, "New-Key-1");
				assert.isDefined(value);
				assert.deepEqual(value, 2222n);
			});

			it("should throw error if resulting schema is invalid", function () {
				// max byte slices are 2 (which we filled in prev test)
				// so this should throw error
				execExpectError(
					stack,
					[0n, parsing.stringToBytes("New-Key-1"), parsing.stringToBytes("New-Val-2")],
					new AppLocalPut([], 1, interpreter),
					RUNTIME_ERRORS.TEAL.INVALID_SCHEMA
				);
			});

			it("should throw error if app is not found", function () {
				interpreter.runtime.ctx.tx.apid = 9999;
				execExpectError(
					stack,
					[0n, parsing.stringToBytes("New-Key-1"), parsing.stringToBytes("New-Val-2")],
					new AppLocalPut([], 1, interpreter),
					RUNTIME_ERRORS.TEAL.APP_NOT_FOUND
				);
			});
		});

		describe("AppGlobalPut", function () {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1828;
			});
			const appID = 1828;

			it("should put the value in global storage", function () {
				// value as byte
				stack.push(parsing.stringToBytes("New-Global-Key"));
				stack.push(parsing.stringToBytes("New-Global-Val"));

				let op = new AppGlobalPut([], 1, interpreter);
				op.execute(stack);

				let value = interpreter.getGlobalState(appID, "New-Global-Key", lineNumber);
				assert.isDefined(value); // idx should not be -1
				assert.deepEqual(value, parsing.stringToBytes("New-Global-Val"));

				// for uint
				stack.push(parsing.stringToBytes("Key"));
				stack.push(1000n);

				op = new AppGlobalPut([], 1, interpreter);
				op.execute(stack);

				value = interpreter.getGlobalState(appID, "Key", lineNumber);
				assert.isDefined(value); // idx should not be -1
				assert.deepEqual(value, 1000n);
			});

			it("should throw error if resulting schema is invalid for global", function () {
				execExpectError(
					stack,
					[parsing.stringToBytes("New-GlobalKey-1"), parsing.stringToBytes("New-GlobalVal-2")],
					new AppGlobalPut([], 1, interpreter),
					RUNTIME_ERRORS.TEAL.INVALID_SCHEMA
				);
			});

			it("should throw error if app is not found in global state", function () {
				interpreter.runtime.ctx.tx.apid = 9999;
				execExpectError(
					stack,
					[parsing.stringToBytes("New-Key-1"), parsing.stringToBytes("New-Val-2")],
					new AppGlobalPut([], 1, interpreter),
					RUNTIME_ERRORS.TEAL.APP_NOT_FOUND
				);
			});
		});

		describe("TEALv4: More Versatile Global and Local Storage", () => {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1828;
			});

			it("should throw error if schema is invalid", function () {
				const invalidKey = "s".repeat(65); // 'sss..65 times'

				// check for byte
				stack.push(parsing.stringToBytes(invalidKey)); // key length > 64
				stack.push(parsing.stringToBytes("Valid-Val"));
				let op = new AppGlobalPut([], 1, interpreter);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_SCHEMA);

				// key is OK, but total length > 128
				stack.push(new Uint8Array(40).fill(1));
				stack.push(new Uint8Array(100).fill(1));
				op = new AppGlobalPut([], 1, interpreter);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_SCHEMA);
			});
		});

		describe("AppLocalDel", function () {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1847;
			});

			it("should remove the key-value pair from account's local storage", function () {
				// for Sender
				stack.push(0n);
				stack.push(parsing.stringToBytes("Local-key"));

				let op = new AppLocalDel([], 1, interpreter);
				op.execute(stack);

				const appID = interpreter.runtime.ctx.tx.apid as number;
				let acc = interpreter.runtime.ctx.state.accounts.get(elonAddr);
				let value = acc?.getLocalState(appID, "Local-Key");
				assert.isUndefined(value); // value should be undefined

				// for Txn.Accounts[A]
				stack.push(1n);
				stack.push(parsing.stringToBytes("Local-key"));

				op = new AppLocalDel([], 1, interpreter);
				op.execute(stack);

				acc = interpreter.runtime.ctx.state.accounts.get(johnAddr);
				value = acc?.getLocalState(appID, "Local-Key");
				assert.isUndefined(value); // value should be undefined
			});
		});

		describe("AppGlobalDel", function () {
			before(function () {
				interpreter.runtime.ctx.tx.apid = 1828;
			});

			it("should remove the key-value pair from global storage", function () {
				stack.push(0n);
				stack.push(parsing.stringToBytes("global-key"));

				const op = new AppGlobalDel([], 1, interpreter);
				op.execute(stack);

				const value = interpreter.getGlobalState(1828, "global-key", lineNumber);
				assert.isUndefined(value); // value should be undefined
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

		it("Int: should push correct TxOnComplete enum value to stack", function () {
			let op = new Int(["NoOp"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(0n, stack.pop());

			op = new Int(["OptIn"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(1n, stack.pop());

			op = new Int(["CloseOut"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(2n, stack.pop());

			op = new Int(["ClearState"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(3n, stack.pop());

			op = new Int(["UpdateApplication"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(4n, stack.pop());

			op = new Int(["DeleteApplication"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(5n, stack.pop());
		});

		it("Int: should push correct TypeEnumConstants enum value to stack", function () {
			let op = new Int(["unknown"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(0n, stack.pop());

			op = new Int(["pay"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(1n, stack.pop());

			op = new Int(["keyreg"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(2n, stack.pop());

			op = new Int(["acfg"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(3n, stack.pop());

			op = new Int(["axfer"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(4n, stack.pop());

			op = new Int(["afrz"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(5n, stack.pop());

			op = new Int(["appl"], 0);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(6n, stack.pop());
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
			const expectedBytes = new Uint8Array(Buffer.from(base64Str, "base64"));

			const op = new Byte(["base64", base64Str], 1);
			op.execute(stack);

			assert.equal(1, stack.length());
			assert.deepEqual(expectedBytes, stack.pop());
		});

		it("Byte: should push parsed base32 string as bytes to stack", function () {
			const base32Str = "MFRGGZDFMY======";
			const expectedBytes = new Uint8Array(convertToBuffer(base32Str, EncodingType.BASE32));

			const op = new Byte(["base32", base32Str], 1);
			op.execute(stack);

			assert.equal(1, stack.length());
			assert.deepEqual(expectedBytes, stack.pop());
		});

		it("Byte: should push parsed hex string as bytes to stack", function () {
			const hexStr = "0x250001000192CD0000002F6D6E742F72";
			const expectedBytes = new Uint8Array(Buffer.from(hexStr.slice(2), "hex"));

			const op = new Byte([hexStr], 1);
			op.execute(stack);

			assert.equal(1, stack.length());
			assert.deepEqual(expectedBytes, stack.pop());
		});

		it("Byte: should push string literal as bytes to stack", function () {
			const str = '"Algorand"';
			const expectedBytes = new Uint8Array(Buffer.from("Algorand"));

			const op = new Byte([str], 1);
			op.execute(stack);

			assert.equal(1, stack.length());
			assert.deepEqual(expectedBytes, stack.pop());
		});
	});

	describe("Balance, GetAssetHolding, GetAssetDef", () => {
		useFixture("asa-check");
		const stack = new Stack<StackElem>();
		let interpreter: Interpreter;

		// setup 1st account
		const acc1: AccountStoreI = new AccountStore(123, {
			addr: elonAddr,
			sk: new Uint8Array(0),
		}); // setup test account
		setDummyAccInfo(acc1);

		this.beforeAll(() => {
			interpreter = new Interpreter();
			const runtime = new Runtime([acc1]);
			interpreter.runtime = runtime; // setup runtime

			// setting txn object
			interpreter.runtime.ctx.tx = TXN_OBJ;
			interpreter.runtime.ctx.tx.snd = Buffer.from(decodeAddress(elonAddr).publicKey);
			interpreter.runtime.ctx.tx.apat = [
				Buffer.from(decodeAddress(elonAddr).publicKey),
				Buffer.from(decodeAddress(johnAddr).publicKey),
			];
			interpreter.runtime.ctx.tx.apas = [3, 112];
		});

		it("should push correct account balance", () => {
			const op = new Balance([], 1, interpreter);

			stack.push(0n); // push sender id

			op.execute(stack);
			const top = stack.pop();

			assert.equal(top, 123n);
		});

		it("should throw account doesn't exist error", () => {
			const op = new Balance([], 1, interpreter);
			stack.push(2n);

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST
			);
		});

		it("should throw index out of bound error", () => {
			const op = new Balance([], 1, interpreter);
			stack.push(8n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("should push correct Asset Balance", () => {
			const op = new GetAssetHolding(["AssetBalance"], 1, interpreter);

			stack.push(1n); // account index
			stack.push(3n); // asset id

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev.toString(), "2");
		});

		it("should push correct Asset Freeze status", () => {
			const op = new GetAssetHolding(["AssetFrozen"], 1, interpreter);

			stack.push(1n); // account index
			stack.push(3n); // asset id

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, 0n);
		});

		it("should push 0 if not defined", () => {
			stack.push(1n); // account index
			stack.push(4n); // asset id

			const op = new GetAssetHolding(["1"], 1, interpreter);
			op.execute(stack);

			const top = stack.pop();
			const prev = stack.pop();
			assert.equal(top, 0n);
			assert.equal(prev, 0n);
		});

		it("should throw index out of bound error", () => {
			const op = new GetAssetHolding(["1"], 1, interpreter);

			stack.push(10n); // account index
			stack.push(4n); // asset id

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("should push correct Asset Total", () => {
			const op = new GetAssetDef(["AssetTotal"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev.toString(), "10000");
		});

		it("should push correct Asset Decimals", () => {
			const op = new GetAssetDef(["AssetDecimals"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev.toString(), "10");
		});

		it("should push correct Asset Default Frozen", () => {
			const op = new GetAssetDef(["AssetDefaultFrozen"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, 0n);
		});

		it("should push correct Asset Unit Name", () => {
			const op = new GetAssetDef(["AssetUnitName"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("AD"));
		});

		it("should push correct Asset Name", () => {
			const op = new GetAssetDef(["AssetName"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("ASSETAD"));
		});

		it("should push correct Asset URL", () => {
			const op = new GetAssetDef(["AssetURL"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("assetUrl"));
		});

		it("should push correct Asset MetaData Hash", () => {
			const op = new GetAssetDef(["AssetMetadataHash"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("hash", EncodingType.BASE64));
		});

		it("should push correct Asset Manager", () => {
			const op = new GetAssetDef(["AssetManager"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("addr-1"));
		});

		it("should push correct Asset Reserve", () => {
			const op = new GetAssetDef(["AssetReserve"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("addr-2"));
		});

		it("should push correct Asset Freeze", () => {
			const op = new GetAssetDef(["AssetFreeze"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("addr-3"));
		});

		it("should push correct Asset Clawback", () => {
			const op = new GetAssetDef(["AssetClawback"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const last = stack.pop();
			const prev = stack.pop();

			assert.deepEqual(last.toString(), "1");
			assert.deepEqual(prev, convertToBuffer("addr-4"));
		});

		it("TEALv5: should push correct Asset Creator", () => {
			interpreter.tealVersion = 5;
			const op = new GetAssetDef(["AssetCreator"], 1, interpreter);

			stack.push(0n); // asset index

			op.execute(stack);
			const isFound = stack.pop();
			const creator = stack.pop();

			assert.deepEqual(isFound.toString(), "1");
			assert.deepEqual(creator, convertToBuffer("addr-1"));
		});

		it("should push 0 if Asset not defined", () => {
			const op = new GetAssetDef(["AssetFreeze"], 1, interpreter);

			stack.push(1n); // account index

			op.execute(stack);

			const top = stack.pop();
			const prev = stack.pop();
			assert.equal(top, 0n);
			assert.equal(prev, 0n);
		});

		it("should throw index out of bound error for Asset Param", () => {
			interpreter.tealVersion = 1;
			const op = new GetAssetDef(["AssetFreeze"], 1, interpreter);

			stack.push(4n); // asset index

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND // for higher versions, reference not found error is thrown
			);
		});

		it("tealv4: should push correct value accepting offset to foreignAssets", () => {
			interpreter.tealVersion = 4;
			// interpreter.runtime.ctx.tx.apas = [1234, 3];
			const op = new GetAssetHolding(["AssetBalance"], 1, interpreter);

			stack.push(1n); // account index
			stack.push(0n); // this will push 1st value from Txn.ForeignAssets
			op.execute(stack);
			assert.deepEqual(stack.pop().toString(), "1");
			assert.deepEqual(stack.pop().toString(), "2");

			stack.push(1n); // account index
			stack.push(3n); // assetId can also be passed directly
			op.execute(stack);
			assert.deepEqual(stack.pop().toString(), "1");
			assert.deepEqual(stack.pop().toString(), "2");
		});

		it("tealv4: should return value as treating ref as offset, if it represents an index", () => {
			interpreter.tealVersion = 4;
			interpreter.runtime.ctx.tx.apas = [1234, 3, 34, 45, 67];
			const op = new GetAssetHolding(["AssetBalance"], 1, interpreter);

			/*
			 * We wanted to pass assetId directly (3n) here, but since length of
			 * foreignAssets array is 5 (line 3363), "3n" will be treated as an offset, and
			 * the value to pushed to stack is Txn.ForeignApps[3] (i.e 45 in this case).
			 * Since asset 45 does not exist, [did_exist flag, value] will be [0, 0]
			 */
			stack.push(1n); // account index
			stack.push(3n); // assetArr.len >= 3, so this is treated as an offset
			op.execute(stack);
			assert.deepEqual(stack.pop().toString(), "0");
			assert.deepEqual(stack.pop().toString(), "0");
		});
	});

	describe("PushInt", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should push uint64 to stack", () => {
			const op = new PushInt([MAX_UINT64.toString()], 0);
			op.execute(stack);

			assert.equal(1, stack.length());
			assert.equal(MAX_UINT64, stack.pop());
		});
	});

	describe("PushBytes", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should push bytes to stack", () => {
			const str = '"Algorand"';
			const expectedBytes = new Uint8Array(Buffer.from("Algorand"));

			const op = new PushBytes([str], 1);
			op.execute(stack);

			assert.equal(1, stack.length());
			assert.deepEqual(expectedBytes, stack.pop());
		});
	});

	describe("Assert", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should not panic if top of stack is non zero uint64", () => {
			const op = new Assert([], 0);
			stack.push(55n);
			assert.doesNotThrow(() => {
				op.execute(stack);
			});
		});

		it("should panic if top of stack is zero or bytes", () => {
			const op = new Assert([], 0);
			stack.push(0n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR);

			stack.push(parsing.stringToBytes("HelloWorld"));
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should throw error if stack is empty", () => {
			const op = new Assert([], 0);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});
	});

	describe("Swap", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should not panic if top of stack is non zero uint64", () => {
			let op = new Swap([], 0);
			stack.push(5n);
			stack.push(10n);

			op.execute(stack);
			assert.equal(stack.length(), 2);
			assert.equal(stack.pop(), 5n);
			assert.equal(stack.pop(), 10n);

			op = new Swap([], 0);
			stack.push(parsing.stringToBytes("hello"));
			stack.push(parsing.stringToBytes("world"));

			op.execute(stack);
			assert.equal(stack.length(), 2);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("hello"));
			assert.deepEqual(stack.pop(), parsing.stringToBytes("world"));

			op = new Swap([], 0);
			stack.push(5n);
			stack.push(parsing.stringToBytes("a"));

			op.execute(stack);
			assert.equal(stack.length(), 2);
			assert.deepEqual(stack.pop(), 5n);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("a"));
		});

		it("should throw error if length of stack < 2", () => {
			const op = new Swap([], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);

			stack.push(1n);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});
	});

	describe("SetBit", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should set bit for uint64", () => {
			const op = new SetBit([], 0);
			stack.push(0n); // target
			stack.push(4n); // index
			stack.push(1n); // bit

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.equal(stack.pop(), 16n);

			stack.push(16n);
			stack.push(0n);
			stack.push(1n);

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.equal(stack.pop(), 17n);

			stack.push(15n);
			stack.push(0n);
			stack.push(0n);

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.equal(stack.pop(), 14n);

			stack.push(0n);
			stack.push(63n);
			stack.push(1n);

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.equal(stack.pop(), 2n ** 63n);

			stack.push(MAX_UINT64);
			stack.push(1n);
			stack.push(0n);

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.equal(stack.pop(), MAX_UINT64 - 2n);
		});

		it("should panic if index bit is not uint64", () => {
			const op = new SetBit([], 0);
			stack.push(0n); // target
			stack.push(new Uint8Array([1, 2])); // index
			stack.push(1n); // bit

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should panic if set bit is not uint64", () => {
			const op = new SetBit([], 0);
			stack.push(0n); // target
			stack.push(4n); // index
			stack.push(new Uint8Array([1, 2])); // bit

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should panic if stack length is less than 3", () => {
			const op = new SetBit([], 0);
			stack.push(0n);
			stack.push(4n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("should panic if set bit is greater than 1", () => {
			const op = new SetBit([], 0);
			stack.push(0n);
			stack.push(4n);
			stack.push(20n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SET_BIT_VALUE_ERROR);
		});

		it("should panic if set bit index is greater than 63 and target is uint64", () => {
			const op = new SetBit([], 0);
			stack.push(0n);
			stack.push(400n);
			stack.push(1n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_ERROR);
		});

		it("should set bit in bytes array", () => {
			const op = new SetBit([], 0);
			stack.push(new Uint8Array([0, 0, 0])); // target
			stack.push(8n); // index
			stack.push(1n); // bit

			// set 8 th bit of bytes to 1 i.e 8th bit will be highest order bit of second byte
			// so second byte will become 2 ** 7 = 128
			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.deepEqual(stack.pop(), new Uint8Array([0, 2 ** 7, 0]));

			// set bit again to 0
			stack.push(new Uint8Array([0, 2 ** 7, 0])); // target
			stack.push(8n); // index
			stack.push(0n); // bit

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.deepEqual(stack.pop(), new Uint8Array([0, 0, 0]));

			stack.push(new Uint8Array([0, 2 ** 7, 0])); // target
			stack.push(0n); // index
			stack.push(1n); // bit

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.deepEqual(stack.pop(), new Uint8Array([2 ** 7, 2 ** 7, 0]));

			stack.push(new Uint8Array([0, 2 ** 7, 0])); // target
			stack.push(7n); // index
			stack.push(1n); // bit

			op.execute(stack);

			assert.equal(stack.length(), 1);
			assert.deepEqual(stack.pop(), new Uint8Array([1, 2 ** 7, 0]));
		});

		it("should panic if index bit in out of bytes array", () => {
			const op = new SetBit([], 0);
			stack.push(new Uint8Array([0, 0, 0])); // target
			stack.push(80n); // index
			stack.push(1n); // bit

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_BYTES_ERROR
			);

			stack.push(new Uint8Array(8).fill(0)); // target
			stack.push(64n * 8n + 1n); // index
			stack.push(1n); // bit

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_BYTES_ERROR
			);
		});
	});

	describe("GetBit", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should push correct bit to stack(uint64)", () => {
			const op = new GetBit([], 0);
			stack.push(8n); // target
			stack.push(3n); // index

			op.execute(stack);
			assert.equal(stack.pop(), 1n);

			stack.push(8n); // target
			stack.push(0n); // index

			op.execute(stack);
			assert.equal(stack.pop(), 0n);
		});

		it("should push correct bit to stack(bytes array)", () => {
			const op = new GetBit([], 0);
			stack.push(new Uint8Array([0, 128, 1])); // target
			stack.push(8n); // index
			op.execute(stack);
			assert.equal(stack.pop(), 1n);

			stack.push(new Uint8Array([1, 4, 1])); // target
			stack.push(23n); // index
			op.execute(stack);
			assert.equal(stack.pop(), 1n);

			stack.push(new Uint8Array([4, 0, 1])); // target
			stack.push(6n); // index
			op.execute(stack);
			assert.equal(stack.pop(), 0n);
		});

		it("should panic if stack length is less than 2", () => {
			const op = new GetBit([], 0);
			stack.push(0n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("should panic if index bit is not uint64", () => {
			const op = new GetBit([], 0);
			stack.push(8n); // target
			stack.push(new Uint8Array(0)); // index

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should panic if index bit in out of uint64 bits", () => {
			const op = new GetBit([], 0);
			stack.push(8n); // target
			stack.push(500n); // index

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_ERROR);
		});

		it("should panic if index bit in out of bytes array", () => {
			const op = new GetBit([], 0);
			stack.push(new Uint8Array(0)); // target
			stack.push(500n); // index

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_BYTES_ERROR
			);
		});
	});

	describe("GetByte", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should get correct bytes from stack", () => {
			const op = new GetByte([], 0);
			stack.push(new Uint8Array([8, 2, 1, 9])); // target
			stack.push(0n); // index

			op.execute(stack);
			assert.equal(stack.pop(), 8n);

			stack.push(new Uint8Array([8, 2, 1, 9])); // target
			stack.push(3n); // index

			op.execute(stack);
			assert.equal(stack.pop(), 9n);

			stack.push(new Uint8Array([1, 2, 3, 4, 5])); // target
			stack.push(2n); // index

			op.execute(stack);
			assert.equal(stack.pop(), 3n);
		});

		it("should panic if target is not bytes", () => {
			const op = new GetByte([], 0);
			stack.push(10n); // target
			stack.push(0n); // index

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should panic if index is not uint", () => {
			const op = new GetByte([], 0);
			stack.push(new Uint8Array(0)); // target
			stack.push(new Uint8Array(0)); // index

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should panic if index bit is out of bytes array", () => {
			const op = new GetByte([], 0);
			stack.push(new Uint8Array(0)); // target
			stack.push(500n); // index

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_BYTES_ERROR
			);

			stack.push(new Uint8Array(5).fill(0)); // target
			stack.push(64n * 5n + 1n); // index

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_BYTES_ERROR
			);
		});
	});

	describe("SetByte", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should set correct bytes and push to stack", () => {
			const op = new SetByte([], 0);
			stack.push(new Uint8Array([8, 2, 1, 9])); // target
			stack.push(0n); // index
			stack.push(5n); // small integer

			op.execute(stack);
			assert.deepEqual(stack.pop(), new Uint8Array([5, 2, 1, 9]));

			stack.push(new Uint8Array([8, 2, 1, 9])); // target
			stack.push(3n); // index
			stack.push(0n); // small integer

			op.execute(stack);
			assert.deepEqual(stack.pop(), new Uint8Array([8, 2, 1, 0]));
		});

		it("should panic if target is not bytes(Uint8Array)", () => {
			const op = new SetByte([], 0);
			stack.push(1n); // target
			stack.push(0n); // index
			stack.push(12n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should panic if index of small integer is not uint", () => {
			const op = new SetByte([], 0);
			stack.push(new Uint8Array(0)); // target
			stack.push(new Uint8Array(0)); // index
			stack.push(12n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);

			stack.push(new Uint8Array(0)); // target
			stack.push(1n); // index
			stack.push(new Uint8Array(0));

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});

		it("should panic if index bit is out of bytes array", () => {
			const op = new SetByte([], 0);
			stack.push(new Uint8Array(0)); // target
			stack.push(500n); // index
			stack.push(12n);

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_BYTES_ERROR
			);

			stack.push(new Uint8Array(5).fill(0)); // target
			stack.push(64n * 5n + 1n); // index
			stack.push(1n);

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.SET_BIT_INDEX_BYTES_ERROR
			);
		});
	});

	describe("Dig", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should duplicate nth slot from top of stack (with uint64 and bytes)", () => {
			let op = new Dig(["1"], 0);
			stack.push(5n);
			stack.push(10n);

			op.execute(stack);
			assert.equal(stack.length(), 3);
			assert.equal(stack.pop(), 5n);
			assert.equal(stack.pop(), 10n);
			assert.equal(stack.pop(), 5n);

			op = new Dig(["1"], 0);
			stack.push(parsing.stringToBytes("hello"));
			stack.push(parsing.stringToBytes("world"));

			op.execute(stack);
			assert.equal(stack.length(), 3);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("hello"));
		});

		it("should duplicate nth slot from top of stack (mixed cases)", () => {
			stack.push(5n);
			stack.push(10n);
			stack.push(parsing.stringToBytes("hello"));
			stack.push(parsing.stringToBytes("world"));
			stack.push(0n);
			stack.push(parsing.stringToBytes("Algorand"));
			stack.push(0n);

			// stack looks like: [...stack, 5n, 10n, "hello", "world", 0n, "Algorand", 0n]
			const len = stack.length();
			let op = new Dig(["4"], 0);
			op.execute(stack);
			assert.equal(stack.length(), len + 1);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("hello"));

			op = new Dig(["6"], 0);
			op.execute(stack);
			assert.equal(stack.length(), len + 1);
			assert.deepEqual(stack.pop(), 5n);

			op = new Dig(["3"], 0);
			op.execute(stack);
			assert.equal(stack.length(), len + 1);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("world"));

			op = new Dig(["1"], 0);
			op.execute(stack);
			assert.equal(stack.length(), len + 1);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("Algorand"));
		});

		it("should panic if depth of stack is insufficient", () => {
			const op = new Dig(["4"], 0);
			stack.push(5n);
			stack.push(10n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});
	});

	describe("Select", () => {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("should push '2nd element from top of stack' to stack if top is not zero", () => {
			let op = new Select([], 0);
			stack.push(parsing.stringToBytes("lionel"));
			stack.push(parsing.stringToBytes("messi"));
			stack.push(7n); // top is non-zero element

			op.execute(stack);
			assert.equal(stack.length(), 1);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("messi"));

			op = new Select([], 0);
			stack.push(parsing.stringToBytes("lionel"));
			stack.push(100n);
			stack.push(7n);

			op.execute(stack);
			assert.equal(stack.length(), 1);
			assert.equal(stack.pop(), 100n);
		});

		it("should push '3rd element from top of stack' to stack if top is zero", () => {
			let op = new Select([], 0);
			stack.push(parsing.stringToBytes("lionel"));
			stack.push(parsing.stringToBytes("messi"));
			stack.push(0n); // top is zero

			op.execute(stack);
			assert.equal(stack.length(), 1);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("lionel"));

			op = new Select([], 0);
			stack.push(100n);
			stack.push(parsing.stringToBytes("messi"));
			stack.push(0n);

			op.execute(stack);
			assert.equal(stack.length(), 1);
			assert.equal(stack.pop(), 100n);
		});

		it("should panic if length of stack is < 3", () => {
			const op = new Select([], 0);
			stack.push(parsing.stringToBytes("lionel"));
			stack.push(0n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("should panic if top of stack is not uint64", () => {
			const op = new Select([], 0);
			stack.push(parsing.stringToBytes("lionel"));
			stack.push(parsing.stringToBytes("andres"));
			stack.push(parsing.stringToBytes("messi"));

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
		});
	});

	describe("Gtxns and Gtxnsa", () => {
		let stack: Stack<StackElem>;
		let interpreter: Interpreter;
		let tx0: EncodedTx, tx1: EncodedTx;

		this.beforeAll(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.tealVersion = MaxTEALVersion;
			tx0 = TXN_OBJ;
			tx1 = { ...tx0, fee: 1011, amt: 2300, apaa: ["argA", "argB", "argC"].map(Buffer.from) };
			interpreter.runtime.ctx.gtxs = [tx0, tx1];
		});

		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("Gtxns: should push value of txfield from tx in group", () => {
			stack.push(0n); // tx to fetch "fee" of (set as first)
			let op = new Gtxns(["Fee"], 1, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(BigInt(tx0.fee as number), stack.pop());

			stack.push(0n);
			op = new Gtxns(["Amount"], 1, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(BigInt(tx0.amt as bigint), stack.pop());

			stack.push(1n); // should fetch data from 2nd tx in group
			op = new Gtxns(["Fee"], 1, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(BigInt(tx1.fee as number), stack.pop());

			stack.push(1n);
			op = new Gtxns(["Amount"], 1, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.equal(BigInt(tx1.amt as bigint), stack.pop());

			// gtxn, gtxns also accepts array fields
			stack.push(1n);
			op = new Gtxns(["ApplicationArgs", "2"], 1, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.deepEqual(parsing.stringToBytes("argC"), stack.pop());
		});

		it("Gtxns: should panic if length of stack is < 1", () => {
			const op = new Gtxns(["Fee"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("Gtxns: should panic if transaction index is out of bounds", () => {
			stack.push(5n); // we only have 2 transactions in group
			const op = new Gtxns(["Fee"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("Gtxnsa: should push value of txfieldArr[index] from tx in group", () => {
			TXN_OBJ.apaa = [Buffer.from("arg1"), Buffer.from("arg2")];
			stack.push(0n);
			let op = new Gtxnsa(["ApplicationArgs", "1"], 1, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.deepEqual(parsing.stringToBytes("arg2"), stack.pop()); // args from tx0

			stack.push(1n);
			op = new Gtxnsa(["ApplicationArgs", "0"], 1, interpreter);
			op.execute(stack);
			assert.equal(1, stack.length());
			assert.deepEqual(parsing.stringToBytes("argA"), stack.pop()); // args from tx1
		});

		it("Gtxnsa: should panic if index is out of bounds for txFieldArr", () => {
			// should throw error as appArgs[10] is undefined
			stack.push(0n);
			let op = new Gtxnsa(["ApplicationArgs", "10"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);

			stack.push(1n);
			op = new Gtxnsa(["ApplicationArgs", "10"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("Gtxns: should panic if transaction index is out of bounds", () => {
			stack.push(5n); // we only have 2 transactions in group
			const op = new Gtxnsa(["ApplicationArgs", "1"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});
	});

	describe("min_balance", () => {
		useFixture("asa-check");
		const stack = new Stack<StackElem>();

		// setup 1st account
		let elon: AccountStoreI = new AccountStore(5e6, { addr: elonAddr, sk: new Uint8Array(0) });
		setDummyAccInfo(elon);

		// setup 2nd account (to be used as Txn.Accounts[A])
		const john = new AccountStore(5e6, { addr: johnAddr, sk: new Uint8Array(0) });
		setDummyAccInfo(john);

		let interpreter: Interpreter;
		before(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([elon, john]);
			interpreter.runtime.ctx.tx.snd = Buffer.from(decodeAddress(elonAddr).publicKey);

			// 'apat': app accounts array
			interpreter.runtime.ctx.tx.apat = [
				decodeAddress(johnAddr).publicKey,
				decodeAddress(generateAccount().addr).publicKey, // random account
			].map(Buffer.from);
		});

		it("should push correct account minimum balance", () => {
			let op = new MinBalance([], 1, interpreter);
			stack.push(0n); // push sender id

			op.execute(stack);
			let top = stack.pop();
			assert.equal(top, BigInt(ALGORAND_ACCOUNT_MIN_BALANCE));

			op = new MinBalance([], 1, interpreter);
			stack.push(1n); // push sender id

			op.execute(stack);
			top = stack.pop();
			assert.equal(top, BigInt(ALGORAND_ACCOUNT_MIN_BALANCE));
		});

		it("should push raised min_balance to stack after creating asset", () => {
			interpreter.runtime.deployASA("gold", { creator: { ...elon.account, name: "elon" } }); // create asset
			elon = interpreter.runtime.getAccount(elon.address); // sync

			const op = new MinBalance([], 1, interpreter);
			stack.push(0n); // push sender index

			op.execute(stack);
			const top = stack.pop();
			assert.equal(top, BigInt(ALGORAND_ACCOUNT_MIN_BALANCE + ASSET_CREATION_FEE));
		});

		it("should panic if account does not exist", () => {
			interpreter.runtime.ctx.tx.apat = [
				decodeAddress(johnAddr).publicKey,
				decodeAddress(generateAccount().addr).publicKey, // random account
			].map(Buffer.from);

			const op = new MinBalance([], 1, interpreter);
			stack.push(2n);

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST
			);
		});

		it("should throw index out of bound error", () => {
			const op = new Balance([], 1, interpreter);
			stack.push(8n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});
	});

	describe("Shared data between contracts opcode(gload, gloads, gloadss)", () => {
		let stack: Stack<StackElem>;
		let interpreter: Interpreter;

		this.beforeAll(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.tealVersion = MaxTEALVersion;
			interpreter.runtime.ctx.tx = TXN_OBJ;
			interpreter.runtime.ctx.sharedScratchSpace = new Map<number, StackElem[]>();
			interpreter.runtime.ctx.sharedScratchSpace.set(0, [12n, 2n, 0n]);
			interpreter.runtime.ctx.sharedScratchSpace.set(2, [12n, 2n, 0n, 1n]);
		});

		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		describe("gload opcode", function () {
			it("should push value from ith tx in shared scratch space(gload)", () => {
				const op = new Gload(["0", "1"], 1, interpreter);

				op.execute(stack);
				const top = stack.pop();

				assert.equal(top, 2n);
			});

			it("should throw error if tx doesn't exist(gload)", () => {
				let op = new Gload(["1", "1"], 1, interpreter);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR);

				op = new Gload(["1", "3"], 1, interpreter);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR);
			});

			it("should throw error if value doesn't exist in stack elem array(gload)", () => {
				const op = new Gload(["2", "5"], 1, interpreter);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
			});
		});

		describe("gloads opcode", function () {
			it("should push value from ith tx in shared scratch space(gloads)", () => {
				const op = new Gloads(["1"], 1, interpreter);
				stack.push(0n);

				op.execute(stack);
				const top = stack.pop();

				assert.equal(top, 2n);
			});

			it("should throw error if tx doesn't exist(gloads)", () => {
				let op = new Gloads(["1"], 1, interpreter);
				stack.push(1n);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR);

				op = new Gloads(["3"], 1, interpreter);
				stack.push(1n);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR);
			});

			it("should throw error if value doesn't exist in stack elem array(gloads)", () => {
				const op = new Gloads(["5"], 1, interpreter);
				stack.push(2n);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
			});
		});

		describe("gloadss opcode(TEAL v6)", function () {
			it("should push value from ith tx in shared scratch space(gloadss)", () => {
				const op = new Gloadss([], 1, interpreter);
				stack.push(0n); // transaction 0th
				stack.push(1n); // scratch space 1st

				op.execute(stack);
				const top = stack.pop();

				assert.equal(top, 2n);
			});

			it("should throw error if tx doesn't exist(gloadss)", () => {
				let op = new Gloadss([], 1, interpreter);
				stack.push(1n);
				stack.push(1n);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR);

				op = new Gloadss([], 1, interpreter);
				stack.push(3n);
				stack.push(1n);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR);
			});

			it("should throw error if value doesn't exist in stack elem array(gloadss)", () => {
				const op = new Gloadss([], 1, interpreter);
				stack.push(2n); // transaction id
				stack.push(5n); // scratch id

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
			});
		});
	});

	describe("TEALv4: Byteslice Arithmetic Ops", () => {
		const hexToByte = (hex: string): Uint8Array => {
			const [string, encoding] = getEncoding([hex], 0);
			return Uint8Array.from(convertToBuffer(string, encoding));
		};

		describe("ByteAdd", () => {
			const stack = new Stack<StackElem>();

			// hex values are taken from go-algorand tests
			// https://github.com/algorand/go-algorand/blob/master/data/transactions/logic/eval_test.go
			it("should return correct addition of two unit64", function () {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				let op = new ByteAdd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x02"));

				stack.push(hexToByte("0x01FF"));
				stack.push(hexToByte("0x01"));
				op = new ByteAdd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x0200"));

				stack.push(hexToByte("0x01234576"));
				stack.push(hexToByte("0x01ffffffffffffff"));
				op = new ByteAdd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), new Uint8Array([2, 0, 0, 0, 1, 35, 69, 117]));

				// u256 + u256
				stack.push(
					hexToByte("0x0123457601234576012345760123457601234576012345760123457601234576")
				);
				stack.push(
					hexToByte("0x01ffffffffffffff01ffffffffffffff01234576012345760123457601234576")
				);
				op = new ByteAdd([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						3, 35, 69, 118, 1, 35, 69, 117, 3, 35, 69, 118, 1, 35, 69, 117, 2, 70, 138, 236, 2,
						70, 138, 236, 2, 70, 138, 236, 2, 70, 138, 236,
					])
				);

				// "A" + "" == "A"
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes(""));
				op = new ByteAdd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), parsing.stringToBytes("A"));
			});

			it("should accept output of > 64 bytes", function () {
				let str = "";
				for (let i = 0; i < 64; i++) {
					str += "ff";
				} // ff repeated 64 times

				stack.push(hexToByte("0x" + str));
				stack.push(hexToByte("0x10"));
				const op = new ByteAdd([], 0);
				assert.doesNotThrow(() => op.execute(stack));
				const top = stack.pop() as Uint8Array;
				assert.isAbove(top.length, 64); // output array is of 65 bytes (because o/p length is limited to 128 bytes)
			});

			it("should throw error with ByteAdd if input > 64 bytes", () => {
				let str = "";
				for (let i = 0; i < 65; i++) {
					str += "ff";
				} // ff repeated "65" times

				stack.push(hexToByte("0x" + str));
				stack.push(hexToByte("0x10"));
				const op = new ByteAdd([], 0);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.BYTES_LEN_EXCEEDED);
			});

			it(
				"should throw error with ByteAdd if stack is below min length",
				execExpectError(
					stack,
					[hexToByte("0x10")],
					new ByteAdd([], 0),
					RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
				)
			);

			it(
				"should throw error if ByteAdd is used with int",
				execExpectError(stack, [1n, 2n], new ByteAdd([], 0), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
			);

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteAdd([], 0);
				assert.equal(10, op.execute(stack));
			});
		});

		describe("ByteSub", () => {
			const stack = new Stack<StackElem>();

			it("should return correct subtraction of two byte arrays", function () {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				let op = new ByteSub([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), parsing.stringToBytes("")); // Byte ""

				stack.push(hexToByte("0x0200"));
				stack.push(hexToByte("0x01"));
				op = new ByteSub([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x01FF"));

				// returns are smallest possible
				stack.push(hexToByte("0x0100"));
				stack.push(hexToByte("0x01"));
				op = new ByteSub([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0xFF"));

				stack.push(hexToByte("0x0ffff1234576"));
				stack.push(hexToByte("0x1202"));
				op = new ByteSub([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), new Uint8Array([15, 255, 241, 35, 51, 116]));

				// big num
				stack.push(
					hexToByte("0x0123457601234576012345760123457601234576012345760123457601234576")
				);
				stack.push(hexToByte("0xffffff01ffffffffffffff01234576012345760123457601234576"));
				op = new ByteSub([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						1, 35, 69, 118, 0, 35, 69, 118, 255, 35, 69, 118, 1, 35, 69, 119, 0, 0, 0, 0, 0, 0,
						0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
					])
				);
			});

			it("should panic on underflow", function () {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x02"));
				const op = new ByteSub([], 0);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_UNDERFLOW);
			});

			it(
				"should throw error with ByteSub if stack is below min length",
				execExpectError(
					stack,
					[hexToByte("0x10")],
					new ByteAdd([], 0),
					RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
				)
			);

			it(
				"should throw error if ByteSub is used with int",
				execExpectError(stack, [1n, 2n], new ByteSub([], 0), RUNTIME_ERRORS.TEAL.INVALID_TYPE)
			);

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteSub([], 0);
				assert.equal(10, op.execute(stack));
			});
		});

		describe("ByteMul", () => {
			const stack = new Stack<StackElem>();

			it("should return correct multiplication of two byte arrays", function () {
				stack.push(hexToByte("0x10"));
				stack.push(hexToByte("0x10"));
				let op = new ByteMul([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x0100"));

				stack.push(hexToByte("0x100000000000"));
				stack.push(hexToByte("0x00"));
				op = new ByteMul([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), parsing.stringToBytes(""));

				// "A" * "" === ""
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes(""));
				op = new ByteMul([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), parsing.stringToBytes(""));

				// u256*u256
				stack.push(
					hexToByte("0xa123457601234576012345760123457601234576012345760123457601234576")
				);
				stack.push(
					hexToByte("0xf123457601234576012345760123457601234576012345760123457601234576")
				);
				op = new ByteMul([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						151, 200, 103, 239, 94, 230, 133, 186, 92, 4, 163, 133, 89, 34, 193, 80, 86, 64,
						223, 27, 83, 94, 252, 230, 80, 125, 26, 177, 77, 155, 56, 124, 72, 239, 162, 240,
						235, 209, 133, 37, 238, 179, 103, 90, 241, 149, 73, 143, 244, 119, 43, 196, 247, 89,
						13, 249, 250, 58, 240, 46, 253, 28, 210, 100,
					])
				);
			});

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteMul([], 0);
				assert.equal(20, op.execute(stack));
			});

			// rest of tests for all opcodes are common, which should be covered by b+, b-
		});

		describe("ByteDiv", () => {
			const stack = new Stack<StackElem>();

			it("should return correct division of two byte arrays", function () {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				let op = new ByteDiv([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x01"));

				// "A" / "A" === "1"
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteDiv([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x01"));

				// u256 / u128
				stack.push(
					hexToByte("0xa123457601234576012345760123457601234576012345760123457601234576")
				);
				stack.push(hexToByte("0x34576012345760123457601234576312"));
				op = new ByteDiv([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						3, 20, 30, 232, 85, 184, 244, 125, 170, 92, 127, 59, 140, 137, 168, 211, 37,
					])
				);
			});

			it("should panic if B == 0", function () {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x00"));
				const op = new ByteDiv([], 0);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ZERO_DIV);
			});

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteDiv([], 0);
				assert.equal(20, op.execute(stack));
			});
		});

		describe("ByteMod", () => {
			const stack = new Stack<StackElem>();

			it("should return correct modulo of two byte arrays", function () {
				stack.push(hexToByte("0x10"));
				stack.push(hexToByte("0x07"));
				let op = new ByteMod([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x02"));

				// "A" % "A" === ""
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteMod([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), parsing.stringToBytes(""));

				// u256 % u128
				stack.push(
					hexToByte("0xa123457601234576012345760123457601234576012345760123457601234576")
				);
				stack.push(hexToByte("0x34576012345760123457601234576312"));
				op = new ByteMod([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						1, 202, 148, 236, 225, 10, 151, 2, 64, 208, 240, 122, 196, 10, 29, 220,
					])
				);
			});

			it("should panic if B == 0", function () {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x00"));
				const op = new ByteMod([], 0);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ZERO_DIV);
			});

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteMod([], 0);
				assert.equal(20, op.execute(stack));
			});
		});

		describe("ByteLessThan", () => {
			const stack = new Stack<StackElem>();

			it("should push 0/1 depending on value of two byte arrays for bytelessthan", function () {
				// A < B
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("B"));
				let op = new ByteLessThan([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);

				// B is not less than A
				stack.push(parsing.stringToBytes("B"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteLessThan([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);

				// A is not less than A
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteLessThan([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);
			});
		});

		describe("ByteGreaterThan", () => {
			const stack = new Stack<StackElem>();

			it("should push 0/1 depending on value of two byte arrays for ByteGreaterThan", function () {
				// A is not greator B
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("B"));
				let op = new ByteGreaterThan([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);

				// B > A
				stack.push(parsing.stringToBytes("B"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteGreaterThan([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);

				// A is not greator than A
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteGreaterThan([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);
			});
		});

		describe("ByteLessThanEqualTo", () => {
			const stack = new Stack<StackElem>();

			it("should push 0/1 depending on value of two byte arrays for ByteLessThanEqualTo", function () {
				// A is <= B
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("B"));
				let op = new ByteLessThanEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);

				// B is not lessthan or equal to A
				stack.push(parsing.stringToBytes("B"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteLessThanEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);

				// A is <= A
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteLessThanEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);
			});
		});

		describe("ByteGreaterThanEqualTo", () => {
			const stack = new Stack<StackElem>();

			it("should push 0/1 depending on value of two byte arrays for ByteGreaterThanEqualTo", function () {
				// A is not >= B
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("B"));
				let op = new ByteGreaterThanEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);

				// B is >= A
				stack.push(parsing.stringToBytes("B"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteGreaterThanEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);

				// A is >= A
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteGreaterThanEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);
			});
		});

		describe("ByteEqualTo", () => {
			const stack = new Stack<StackElem>();

			it("should push 0/1 depending on value of two byte arrays for ByteEqualTo", function () {
				// A is not == B
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("B"));
				let op = new ByteEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);

				// A == A
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);

				// "" == ""
				stack.push(parsing.stringToBytes(""));
				stack.push(parsing.stringToBytes(""));
				op = new ByteEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);
			});
		});

		describe("ByteNotEqualTo", () => {
			const stack = new Stack<StackElem>();

			it("should push 0/1 depending on value of two byte arrays for ByteNotEqualTo", function () {
				// A is not == B
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("B"));
				let op = new ByteNotEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 1n);

				// A == A
				stack.push(parsing.stringToBytes("A"));
				stack.push(parsing.stringToBytes("A"));
				op = new ByteNotEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);

				// "" !== ""
				stack.push(parsing.stringToBytes(""));
				stack.push(parsing.stringToBytes(""));
				op = new ByteNotEqualTo([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), 0n);
			});
		});

		describe("ByteBitwiseOr", () => {
			const stack = new Stack<StackElem>();

			it("should push OR of two byte arrays for ByteBitwiseOr", function () {
				stack.push(hexToByte("0x11"));
				stack.push(hexToByte("0x10"));
				let op = new ByteBitwiseOr([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x11"));

				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x10"));
				op = new ByteBitwiseOr([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x11"));

				stack.push(hexToByte("0x0201"));
				stack.push(hexToByte("0x10f1"));
				op = new ByteBitwiseOr([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x12f1"));

				stack.push(hexToByte("0x0001"));
				stack.push(hexToByte("0x00f1"));
				op = new ByteBitwiseOr([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x00f1"));
			});

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteBitwiseOr([], 0);
				assert.equal(6, op.execute(stack));
			});
		});

		describe("ByteBitwiseAnd", () => {
			const stack = new Stack<StackElem>();

			it("should push AND of two byte arrays for ByteBitwiseAnd", function () {
				stack.push(hexToByte("0x11"));
				stack.push(hexToByte("0x10"));
				let op = new ByteBitwiseAnd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x10"));

				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x10"));
				op = new ByteBitwiseAnd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x00"));

				stack.push(hexToByte("0x0201"));
				stack.push(hexToByte("0x10f1"));
				op = new ByteBitwiseAnd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x0001"));

				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x00f1"));
				op = new ByteBitwiseAnd([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x0001"));

				stack.push(
					hexToByte("0x0123457601234576012345760123457601234576012345760123457601234576")
				);
				stack.push(
					hexToByte("0x01ffffffffffffff01ffffffffffffff01234576012345760123457601234576")
				);
				op = new ByteBitwiseAnd([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						1, 35, 69, 118, 1, 35, 69, 118, 1, 35, 69, 118, 1, 35, 69, 118, 1, 35, 69, 118, 1,
						35, 69, 118, 1, 35, 69, 118, 1, 35, 69, 118,
					])
				);
			});

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteBitwiseAnd([], 0);
				assert.equal(6, op.execute(stack));
			});
		});

		describe("ByteBitwiseXOR", () => {
			const stack = new Stack<StackElem>();

			it("should push XOR of two byte arrays for ByteBitwiseXOR", function () {
				stack.push(hexToByte("0x11"));
				stack.push(hexToByte("0x10"));
				let op = new ByteBitwiseXor([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x01"));

				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x10"));
				op = new ByteBitwiseXor([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x11"));

				stack.push(hexToByte("0x0201"));
				stack.push(hexToByte("0x10f1"));
				op = new ByteBitwiseXor([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x12f0"));

				stack.push(hexToByte("0x0001"));
				stack.push(hexToByte("0xf1"));
				op = new ByteBitwiseXor([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x00f0"));

				stack.push(
					hexToByte("0x123457601234576012345760123457601234576012345760123457601234576a")
				);
				stack.push(
					hexToByte("0xf123457601234576012345760123457601234576012345760123457601234576")
				);
				op = new ByteBitwiseXor([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						227, 23, 18, 22, 19, 23, 18, 22, 19, 23, 18, 22, 19, 23, 18, 22, 19, 23, 18, 22, 19,
						23, 18, 22, 19, 23, 18, 22, 19, 23, 18, 28,
					])
				);
			});

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteBitwiseXor([], 0);
				assert.equal(6, op.execute(stack));
			});
		});

		describe("ByteBitwiseInvert", () => {
			const stack = new Stack<StackElem>();

			it("should push bitwise invert of byte array", function () {
				stack.push(hexToByte("0x0001"));
				let op = new ByteBitwiseInvert([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0xfffe"));

				stack.push(hexToByte("0x"));
				op = new ByteBitwiseInvert([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x"));

				stack.push(hexToByte("0xf001"));
				op = new ByteBitwiseInvert([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x0ffe"));

				stack.push(
					hexToByte("0xa123457601234576012345760123457601234576012345760123457601234576")
				);
				op = new ByteBitwiseInvert([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					new Uint8Array([
						94, 220, 186, 137, 254, 220, 186, 137, 254, 220, 186, 137, 254, 220, 186, 137, 254,
						220, 186, 137, 254, 220, 186, 137, 254, 220, 186, 137, 254, 220, 186, 137,
					])
				);
			});

			it("Should calculate correct cost", () => {
				stack.push(hexToByte("0x01"));
				stack.push(hexToByte("0x01"));
				const op = new ByteBitwiseInvert([], 0);
				assert.equal(4, op.execute(stack));
			});
		});

		describe("ByteZero", () => {
			const stack = new Stack<StackElem>();

			it("should push zero byte array to stack", function () {
				stack.push(3n);
				let op = new ByteZero([], 0);
				op.execute(stack);
				assert.deepEqual(stack.pop(), hexToByte("0x000000"));

				stack.push(33n);
				op = new ByteZero([], 0);
				op.execute(stack);
				assert.deepEqual(
					stack.pop(),
					hexToByte("0x000000000000000000000000000000000000000000000000000000000000000000")
				);
			});

			it("should fail if len > 4096", function () {
				stack.push(4097n);
				let op = new ByteZero([], 0);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.BYTES_LEN_EXCEEDED);

				stack.push(4096n);
				op = new ByteZero([], 0);
				assert.doesNotThrow(() => op.execute(stack));
			});
		});
	});

	describe("Tealv4: Additional mathematical opcodes", () => {
		const stack = new Stack<StackElem>();

		it("divmodw", () => {
			stack.push(0n);
			stack.push(500n);
			stack.push(0n);
			stack.push(10n);

			const op = new DivModw([], 1);
			op.execute(stack);

			assert.equal(stack.pop(), 0n);
			assert.equal(stack.pop(), 0n);
			assert.equal(stack.pop(), 50n);
			assert.equal(stack.pop(), 0n);

			stack.push(MAX_UINT64);
			stack.push(MAX_UINT64);
			stack.push(0n);
			stack.push(1n);

			op.execute(stack);

			assert.equal(stack.pop(), 0n);
			assert.equal(stack.pop(), 0n);
			assert.equal(stack.pop(), MAX_UINT64);
			assert.equal(stack.pop(), MAX_UINT64);

			stack.push(MAX_UINT64);
			stack.push(5n);
			stack.push(MAX_UINT64);
			stack.push(0n);

			op.execute(stack);

			assert.equal(stack.pop(), 5n);
			assert.equal(stack.pop(), 0n);
			assert.equal(stack.pop(), 1n);
			assert.equal(stack.pop(), 0n);
		});

		it("exp", () => {
			stack.push(2n);
			stack.push(5n);
			const op = new Exp([], 1);

			op.execute(stack);
			assert.equal(stack.pop(), 32n);

			stack.push(5n);
			stack.push(0n);

			op.execute(stack);
			assert.equal(stack.pop(), 1n);

			stack.push(0n);
			stack.push(1n);

			op.execute(stack);
			assert.equal(stack.pop(), 0n);

			stack.push(2n);
			stack.push(63n);

			op.execute(stack);
			assert.equal(stack.pop(), 2n ** 63n);

			stack.push(2n);
			stack.push(64n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW);

			stack.push(0n);
			stack.push(0n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXP_ERROR);

			stack.push(2n);
			stack.push(66n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW);
		});

		it("expw", () => {
			stack.push(2n);
			stack.push(66n);
			const op = new Expw([], 1);

			op.execute(stack);
			const res = 2n ** 66n;
			const low = res & MAX_UINT64;
			const high = res >> BigInt("64");

			assert.equal(stack.pop(), low);
			assert.equal(stack.pop(), high);

			stack.push(5n);
			stack.push(0n);

			op.execute(stack);
			assert.equal(stack.pop(), 1n);

			stack.push(0n);
			stack.push(0n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXP_ERROR);

			stack.push(2n);
			stack.push(128n);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT128_OVERFLOW);
		});

		it("shl", () => {
			stack.push(0n);
			stack.push(20n);

			let exp = 0n << 20n;
			const op = new Shl([], 1);
			op.execute(stack);

			assert.equal(stack.pop(), exp);

			stack.push(5n);
			stack.push(21n);

			exp = 5n << 21n;
			op.execute(stack);

			assert.equal(stack.pop(), exp);
		});

		it("shr", () => {
			stack.push(0n);
			stack.push(20n);

			let exp = 0n >> 20n;
			const op = new Shr([], 1);
			op.execute(stack);
			assert.equal(stack.pop(), exp);

			stack.push(5n);
			stack.push(21n);
			exp = 5n >> 21n;
			op.execute(stack);
			assert.equal(stack.pop(), exp);
		});

		it("sqrt", () => {
			stack.push(5n);
			const op = new Sqrt([], 1);
			op.execute(stack);

			assert.equal(stack.pop(), 2n);

			stack.push(1024n);
			op.execute(stack);

			assert.equal(stack.pop(), 32n);

			stack.push(1023n);
			op.execute(stack);

			assert.equal(stack.pop(), 31n);
		});
	});

	describe("Tealv5: Extract opcodes", () => {
		const stack = new Stack<StackElem>();
		const longByte = parsing.stringToBytes("a".repeat(400));

		it("extract", () => {
			stack.push(new Uint8Array([12, 23, 3, 2, 23, 43, 43, 12]));
			let op = new Extract(["1", "3"], 1);
			op.execute(stack);

			assert.deepEqual(stack.pop(), new Uint8Array([23, 3, 2]));

			// If L is 0, then extract to the end of the string.
			stack.push(new Uint8Array([12, 23, 2, 4]));
			op = new Extract(["1", "0"], 1);
			op.execute(stack);

			assert.deepEqual(stack.pop(), new Uint8Array([23, 2, 4]));

			// big bytes(length = 400)
			stack.push(longByte);
			op = new Extract(["300", "10"], 1);
			op.execute(stack);

			assert.deepEqual(stack.pop(), parsing.stringToBytes("a".repeat(10)));

			stack.push(new Uint8Array([12, 23]));
			op = new Extract(["1", "10"], 1);

			// If S or S+L is larger than the array length, the program fails
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXTRACT_RANGE_ERROR);

			stack.push(new Uint8Array([12, 23]));
			op = new Extract(["111", "1"], 1);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXTRACT_RANGE_ERROR);
		});

		it("extract3", () => {
			const op = new Extract3([], 1);

			stack.push(new Uint8Array([12, 23, 3, 2, 23, 43, 43, 12]));
			stack.push(1n);
			stack.push(3n);
			op.execute(stack);
			assert.deepEqual(stack.pop(), new Uint8Array([23, 3, 2]));

			stack.push(longByte);
			stack.push(300n);
			stack.push(10n);
			op.execute(stack);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("a".repeat(10)));

			stack.push(new Uint8Array([12, 23]));
			stack.push(1n);
			stack.push(10n);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXTRACT_RANGE_ERROR);
		});

		it("extract_uint16", () => {
			const op = new ExtractUint16([], 1);
			let expected: bigint;

			stack.push(new Uint8Array([1, 2, 3, 4, 5]));
			stack.push(2n);
			op.execute(stack);
			expected = bigEndianBytesToBigInt(new Uint8Array([3, 4]));
			assert.equal(stack.pop(), expected);

			// long byte
			stack.push(longByte);
			stack.push(300n);
			op.execute(stack);
			expected = bigEndianBytesToBigInt(new Uint8Array([97, 97]));
			assert.equal(stack.pop(), expected);

			// throw error
			stack.push(new Uint8Array([1, 2, 3, 4, 5]));
			stack.push(4n);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXTRACT_RANGE_ERROR);
		});

		it("extract_uint32", () => {
			const op = new ExtractUint32([], 1);
			let expected: bigint;

			stack.push(new Uint8Array([1, 2, 3, 4, 5]));
			stack.push(1n);
			op.execute(stack);
			expected = bigEndianBytesToBigInt(new Uint8Array([2, 3, 4, 5]));
			assert.equal(stack.pop(), expected);

			// long bytes
			stack.push(longByte);
			stack.push(300n);
			op.execute(stack);
			expected = bigEndianBytesToBigInt(new Uint8Array([97, 97, 97, 97]));
			assert.equal(stack.pop(), expected);

			// throw error
			stack.push(new Uint8Array([1, 2, 3, 4, 5]));
			stack.push(4n);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXTRACT_RANGE_ERROR);
		});

		it("extract_uint64", () => {
			const op = new ExtractUint64([], 1);
			let expected: bigint;

			stack.push(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
			stack.push(2n);
			op.execute(stack);
			expected = bigEndianBytesToBigInt(new Uint8Array([3, 4, 5, 6, 7, 8, 9, 10]));
			assert.equal(stack.pop(), expected);

			stack.push(longByte);
			stack.push(300n);
			op.execute(stack);
			expected = bigEndianBytesToBigInt(new Uint8Array([97, 97, 97, 97, 97, 97, 97, 97]));
			assert.equal(stack.pop(), expected);

			stack.push(new Uint8Array([1, 2, 3, 4, 5]));
			stack.push(8n);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.EXTRACT_RANGE_ERROR);
		});
	});

	describe("Tealv5: ECDSA", () => {
		const stack = new Stack<StackElem>();
		const ec = new EC("secp256k1");
		const key = ec.genKeyPair();
		const pkX = key.getPublic().getX().toBuffer();
		const pkY = key.getPublic().getY().toBuffer();
		const msgHash = new Uint8Array([0, 1, 2, 3, 4, 5]);
		const signature = key.sign(msgHash);

		it("ecdsa_verify, should verify correct signature", () => {
			// push message
			stack.push(msgHash);
			// push signature
			stack.push(signature.r.toBuffer());
			stack.push(signature.s.toBuffer());
			// push public key
			stack.push(pkX);
			stack.push(pkY);

			const op = new EcdsaVerify(["0"], 1);
			op.execute(stack);

			assert.equal(stack.pop(), 1n);

			const r = signature.r.toBuffer();
			r[0] = ~r[0];
			stack.push(msgHash);
			stack.push(r);
			stack.push(signature.s.toBuffer());
			stack.push(pkX);
			stack.push(pkY);
			op.execute(stack);

			assert.equal(stack.pop(), 0n);

			const s = signature.r.toBuffer();
			s[0] = ~s[0];
			stack.push(msgHash);
			stack.push(signature.r.toBuffer());
			stack.push(s);
			stack.push(pkX);
			stack.push(pkY);
			op.execute(stack);

			assert.equal(stack.pop(), 0n);
		});

		it("ecdsa_verify, should not verify wrong signature", () => {
			// push message
			stack.push(msgHash);
			// push signature (signed by key)
			stack.push(signature.r.toBuffer());
			stack.push(signature.s.toBuffer());
			const wrongKey = ec.genKeyPair();
			// push public key(public key is wrong)
			stack.push(wrongKey.getPublic().getX().toBuffer());
			stack.push(wrongKey.getPublic().getY().toBuffer());

			const op = new EcdsaVerify(["0"], 1);
			op.execute(stack);

			assert.equal(stack.pop(), 0n);
		});

		it("ecdsa_verify, should throw error if curve is not supported", () => {
			stack.push(msgHash);
			stack.push(signature.r.toBuffer());
			stack.push(signature.s.toBuffer());
			stack.push(pkX);
			stack.push(pkY);

			const op = new EcdsaVerify(["2"], 1);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED);
		});

		it("ecdsa_pk_decompress", () => {
			// https://bitcoin.stackexchange.com/questions/69315/how-are-compressed-pubkeys-generated
			// example taken from above link
			const compressed = "0250863AD64A87AE8A2FE83C1AF1A8403CB53F53E486D8511DAD8A04887E5B2352";
			stack.push(Buffer.from(compressed, "hex"));

			let op = new EcdsaPkDecompress(["0"], 1);
			op.execute(stack);

			assert.deepEqual(
				stack.pop(),
				Buffer.from("2CD470243453A299FA9E77237716103ABC11A1DF38855ED6F2EE187E9C582BA6", "hex")
			);
			assert.deepEqual(
				stack.pop(),
				Buffer.from("50863AD64A87AE8A2FE83C1AF1A8403CB53F53E486D8511DAD8A04887E5B2352", "hex")
			);

			stack.push(Buffer.from(compressed, "hex"));
			op = new EcdsaPkDecompress(["2"], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED);
		});

		it("ecdsa_pk_recover", () => {
			// push message
			stack.push(msgHash);
			// push recovery id
			stack.push(BigInt(signature.recoveryParam ?? 0n));
			// push signature
			stack.push(signature.r.toBuffer());
			stack.push(signature.s.toBuffer());

			let op = new EcdsaPkRecover(["0"], 1);
			op.execute(stack);

			assert.deepEqual(stack.pop(), pkY);
			assert.deepEqual(stack.pop(), pkX);

			stack.push(msgHash);
			stack.push(2n);
			stack.push(signature.r.toBuffer());
			stack.push(signature.s.toBuffer());
			op = new EcdsaPkRecover(["2"], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED);
		});

		it("Should calculate correct cost", () => {
			//EdcsaVerify
			stack.push(msgHash);
			stack.push(signature.r.toBuffer());
			stack.push(signature.s.toBuffer());
			stack.push(pkX);
			stack.push(pkY);
			let op = new EcdsaVerify(["0"], 1);
			assert.equal(1700, op.execute(stack));
			//EcdsaPkDecompress
			const compressed = "0250863AD64A87AE8A2FE83C1AF1A8403CB53F53E486D8511DAD8A04887E5B2352";
			stack.push(Buffer.from(compressed, "hex"));
			op = new EcdsaPkDecompress(["0"], 1);
			assert.equal(650, op.execute(stack));

			//EcdsaPkRecover
			stack.push(msgHash);
			stack.push(BigInt(signature.recoveryParam ?? 0n));
			stack.push(signature.r.toBuffer());
			stack.push(signature.s.toBuffer());
			op = new EcdsaPkRecover(["0"], 1);
			assert.equal(2000, op.execute(stack));
		});
	});

	describe("Tealv5: cover, uncover", () => {
		let stack: Stack<StackElem>;
		beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		const push = (stack: Stack<StackElem>, n: number): void => {
			for (let i = 1; i <= n; ++i) {
				stack.push(BigInt(i));
			}
		};

		it("cover: move top to below N elements", () => {
			push(stack, 4);

			const op = new Cover(["2"], 1);
			// move top below 2 elements
			op.execute(stack);

			assert.equal(stack.pop(), 3n);
			assert.equal(stack.pop(), 2n);
			assert.equal(stack.pop(), 4n);
			assert.equal(stack.pop(), 1n);
		});
		it("cover: should throw error is length of stack is not enough", () => {
			push(stack, 4);

			const op = new Cover(["5"], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("cover: n == 0", () => {
			push(stack, 4);

			const op = new Cover(["0"], 1);
			op.execute(stack);

			assert.equal(stack.pop(), 4n);
			assert.equal(stack.pop(), 3n);
			assert.equal(stack.pop(), 2n);
			assert.equal(stack.pop(), 1n);
		});

		it("cover: n == stack.length", () => {
			push(stack, 4);

			const op = new Cover(["4"], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("uncover: n = 1", () => {
			push(stack, 4); // stack state = [1, 2, 3, 4]
			const op = new Uncover(["1"], 1);

			// move top to below 1 element
			op.execute(stack);

			// stack state = [1, 2, 4, 3]
			assert.equal(stack.length(), 4);

			assert.equal(stack.pop(), 3n);
			assert.equal(stack.pop(), 4n);
			assert.equal(stack.pop(), 2n);
			assert.equal(stack.pop(), 1n);
		});

		it("uncover: n = 0 - stack state should not change", () => {
			push(stack, 4); // stack state = [1, 2, 3, 4]

			const op = new Uncover(["0"], 1);
			op.execute(stack);

			// stack state = [1, 2, 3, 4]
			assert.equal(stack.length(), 4);

			assert.equal(stack.pop(), 4n);
			assert.equal(stack.pop(), 3n);
			assert.equal(stack.pop(), 2n);
			assert.equal(stack.pop(), 1n);
		});

		it("uncover: push bytes and apply 'uncover 1'", () => {
			push(stack, 3); // stack state = [1, 2, 3]
			stack.push(parsing.stringToBytes("Hello world")); // stack state = [1, 2, 3, "Hello world"]

			const op = new Uncover(["1"], 1);

			// move top to below 1 element
			op.execute(stack);

			// stack state = [1, 2, "Hello world", 3]
			assert.equal(stack.length(), 4);

			assert.equal(stack.pop(), 3n);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("Hello world"));
			assert.equal(stack.pop(), 2n);
			assert.equal(stack.pop(), 1n);
		});

		it("uncover: move Nth value to top", () => {
			push(stack, 4); // stack state = [1, 2, 3, 4]

			const op = new Uncover(["3"], 1);
			// move top below 2 elements
			op.execute(stack);

			// stack state = [2, 3, 4, 1]
			assert.equal(stack.length(), 4);

			assert.equal(stack.pop(), 1n);
			assert.equal(stack.pop(), 4n);
			assert.equal(stack.pop(), 3n);
			assert.equal(stack.pop(), 2n);
		});

		it("uncover: should throw error is length of stack is not enough", () => {
			push(stack, 4);

			const op = new Uncover(["5"], 1);

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});
	});

	describe("Tealv5: txnas, Gtxnas, gtxnsas, args, log", () => {
		const stack = new Stack<StackElem>();
		let interpreter: Interpreter;
		before(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.tx = TXN_OBJ;
			interpreter.tealVersion = MaxTEALVersion; // set tealversion to latest (to support all tx fields)
			// a) 'apas' represents 'foreignAssets', b) 'apfa' represents 'foreignApps' (id's of foreign apps)
			// https://developer.algorand.org/docs/reference/transactions/
			const tx2 = { ...TXN_OBJ, fee: 2222, apas: [3033, 4044], apfa: [5005, 6006, 7077] };
			interpreter.runtime.ctx.gtxs = [TXN_OBJ, tx2];
		});

		describe("Txnas", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "pay";
			});

			it("push addr from txn.Accounts to stack according to index", function () {
				// index 0 should push sender's address to stack
				stack.push(0n);
				let op = new Txnas(["Accounts"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.tx.snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				stack.push(1n);
				op = new Txnas(["Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				stack.push(2n);
				op = new Txnas(["Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
			});

			it("push addr from 1st AppArg to stack", function () {
				stack.push(0n);
				const op = new Txnas(["ApplicationArgs"], 0, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apaa[0], stack.pop());
			});
		});

		describe("Gtxnas", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "pay";
			});

			it("push addr from 1st account of 2nd Txn in txGrp to stack", function () {
				// index 0 should push sender's address to stack from 1st tx
				stack.push(0n);
				let op = new Gtxnas(["0", "Accounts"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.gtxs[0].snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				stack.push(1n);
				op = new Gtxnas(["0", "Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				stack.push(2n);
				op = new Gtxnas(["0", "Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
			});

			it("should throw error if field is not an array", function () {
				stack.push(0n);
				execExpectError(
					stack,
					[],
					new Gtxnas(["1", "Accounts"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
				);
			});
		});

		describe("Gtxnsas", function () {
			before(function () {
				interpreter.runtime.ctx.tx.type = "pay";
				while (stack.length()) {
					stack.pop();
				} // empty stack firstt
			});

			it("push addr from 1st account of 2nd Txn in txGrp to stack", function () {
				// index 0 should push sender's address to stack from 1st tx
				stack.push(0n);
				stack.push(0n);
				let op = new Gtxnsas(["Accounts"], 1, interpreter);
				op.execute(stack);

				const senderPk = Uint8Array.from(interpreter.runtime.ctx.gtxs[0].snd);
				assert.equal(1, stack.length());
				assert.deepEqual(senderPk, stack.pop());

				// should push Accounts[0] to stack
				stack.push(0n);
				stack.push(1n);
				op = new Gtxnsas(["Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[0], stack.pop());

				// should push Accounts[1] to stack
				stack.push(0n);
				stack.push(2n);
				op = new Gtxnsas(["Accounts"], 1, interpreter);
				op.execute(stack);

				assert.equal(1, stack.length());
				assert.deepEqual(TXN_OBJ.apat[1], stack.pop());
			});

			it("should throw error if field is not an array", function () {
				stack.push(1n);
				stack.push(0n);
				execExpectError(
					stack,
					[],
					new Gtxnsas(["Accounts"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.INVALID_OP_ARG
				);
			});
		});

		describe("Args[N]", function () {
			const args = ["Arg0", "Arg1", "Arg2", "Arg3"].map(parsing.stringToBytes);
			this.beforeAll(() => {
				interpreter.runtime.ctx.args = args;
			});

			it("should push arg_0 from argument array to stack", function () {
				stack.push(0n);
				const op = new Args([], 1, interpreter);
				op.execute(stack);

				const top = stack.pop();
				assert.deepEqual(top, args[0]);
			});

			it("should push arg_1 from argument array to stack", function () {
				stack.push(1n);
				const op = new Args([], 1, interpreter);
				op.execute(stack);

				const top = stack.pop();
				assert.deepEqual(top, args[1]);
			});

			it("should push arg_2 from argument array to stack", function () {
				stack.push(2n);
				const op = new Args([], 1, interpreter);
				op.execute(stack);

				const top = stack.pop();
				assert.deepEqual(top, args[2]);
			});

			it("should push arg_3 from argument array to stack", function () {
				stack.push(3n);
				const op = new Args([], 1, interpreter);
				op.execute(stack);

				const top = stack.pop();
				assert.deepEqual(top, args[3]);
			});

			it("should throw error if accessing arg is not defined", function () {
				stack.push(5n);
				const op = new Args([], 1, interpreter);
				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
			});
		});

		describe("Log", function () {
			let txID: string;
			this.beforeAll(() => {
				txID = interpreter.runtime.ctx.tx.txID;
				interpreter.runtime.ctx.state.txReceipts.set(txID, {
					txn: interpreter.runtime.ctx.tx,
					txID: txID,
				});
			});

			it("should push arg_0 from argument array to stack", function () {
				let txInfo = interpreter.runtime.ctx.state.txReceipts.get(txID);
				assert.isUndefined(txInfo?.logs);
				const op = new Log([], 1, interpreter);

				stack.push(parsing.stringToBytes("Hello"));
				op.execute(stack);
				stack.push(parsing.stringToBytes("Friend?"));
				op.execute(stack);
				stack.push(parsing.stringToBytes("That's lame"));
				op.execute(stack);

				txInfo = interpreter.runtime.ctx.state.txReceipts.get(txID);
				assert.deepEqual(txInfo?.logs, [
					parsing.stringToBytes("Hello"),
					parsing.stringToBytes("Friend?"),
					parsing.stringToBytes("That's lame"),
				]);
			});

			it("should throw error with uint64", function () {
				stack.push(1n);
				const op = new Log([], 1, interpreter);

				expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_TYPE);
			});
		});
	});

	describe("BitLen opcode", function () {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack();
		});

		it("should work with number", () => {
			const numbers = [0n, 1n, 2n, 4n, 5n, 8n];
			const expecteds = [0n, 1n, 2n, 3n, 3n, 4n];
			numbers.forEach((num, index) => {
				stack.push(num);
				const op = new BitLen([], 1);
				op.execute(stack);
				assert.equal(stack.pop(), expecteds[index]);
			});
		});

		it("shoud work with any short byte array", () => {
			const bytes = "abcd";
			const op = new BitLen([], 1);

			stack.push(parsing.stringToBytes(bytes));
			op.execute(stack);
			assert.equal(stack.pop(), 31n);
		});

		it("shoud work with a long byte array", () => {
			const bytes = "f".repeat(78);
			const op = new BitLen([], 1);

			stack.push(parsing.stringToBytes(bytes));
			op.execute(stack);
			assert.equal(stack.pop(), 623n);
		});
	});

	describe("TEALv5: app_params_get", function () {
		useFixture("stateful");
		let appInfo: SSCAttributesM;
		let appID: number;
		let alan: AccountStoreI;
		let runtime: Runtime;
		let interpreter: Interpreter;
		let stack: Stack<StackElem>;

		this.beforeEach(() => {
			alan = new AccountStore(1e9);
			runtime = new Runtime([alan]);
			appID = runtime.deployApp(
				alan.account,
				{
					appName: "app",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "counter-approval.teal",
					clearProgramFilename: "clear.teal",
					globalInts: 1,
					globalBytes: 2,
					localInts: 3,
					localBytes: 4,
				},
				{}
			).appID;

			appInfo = runtime.getApp(appID);

			// initial "context" for interpreter
			interpreter = new Interpreter();
			interpreter.tealVersion = 5;
			interpreter.runtime = runtime;

			stack = new Stack();
		});

		it("should return AppApprovalProgram", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppApprovalProgram"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.deepEqual(stack.pop(), parsing.stringToBytes(getProgram("counter-approval.teal")));
		});

		it("should return AppClearStateProgram", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppClearStateProgram"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.deepEqual(stack.pop(), parsing.stringToBytes(getProgram("clear.teal")));
		});

		it("should return AppGlobalNumUint", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppGlobalNumUint"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.equal(stack.pop(), BigInt(appInfo["global-state-schema"].numUint));
		});

		it("should return AppGlobalNumByteSlice", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppGlobalNumByteSlice"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.equal(stack.pop(), BigInt(appInfo["global-state-schema"].numByteSlice));
		});

		it("should return AppLocalNumUint", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppLocalNumUint"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.equal(stack.pop(), BigInt(appInfo["local-state-schema"].numUint));
		});

		it("should return AppLocalNumByteSlice", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppLocalNumByteSlice"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.equal(stack.pop(), BigInt(appInfo["local-state-schema"].numByteSlice));
		});

		it("should return AppExtraProgramPages", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppExtraProgramPages"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.equal(stack.pop(), 1n);
		});

		it("should return AppCreator", () => {
			stack.push(BigInt(appID));
			const op = new AppParamsGet(["AppCreator"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.equal(encodeAddress(stack.pop() as Uint8Array), alan.address);
		});

		it("should return AppAddress", () => {
			const op = new AppParamsGet(["AppAddress"], 1, interpreter);
			stack.push(BigInt(appID));
			op.execute(stack);
			assert.equal(stack.pop(), 1n);
			assert.equal(encodeAddress(stack.pop() as Uint8Array), getApplicationAddress(appID));
		});

		it("return '0,0' when app is undefined", () => {
			stack.push(10n);
			const op = new AppParamsGet(["AppCreator"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 0n);
			assert.equal(stack.pop(), 0n);
		});

		it("Should fail number element in stack less than 1", () => {
			assert.equal(stack.length(), 0);
			const op = new AppParamsGet(["AppCreator"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("should fail when teal version is less than 5", () => {
			const versions = [1, 2, 3, 4];
			versions.forEach((version) => {
				interpreter.tealVersion = version;
				stack.push(BigInt(appID));
				expectRuntimeError(
					() => new AppParamsGet(["AppCreator"], 1, interpreter),
					RUNTIME_ERRORS.TEAL.UNKNOWN_APP_FIELD
				);
			});
		});

		it("should fail when arguments invalid", () => {
			stack.push(BigInt(appID));
			expectRuntimeError(
				() => new AppParamsGet(["AppCreatorInvalid"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_APP_FIELD
			);
		});
	});

	describe("TEALv6: divw and bsqrt opcodes", function () {
		let stack: Stack<StackElem>;

		const initStack = (values: StackElem[]): Stack<StackElem> => {
			const st: Stack<StackElem> = new Stack();
			values.forEach((value) => {
				st.push(value);
			});
			return st;
		};

		it("Divw opcode happy cases", () => {
			const op = new Divw([], 0);

			// 1/ 1
			stack = initStack([0n, 1n, 1n]);
			op.execute(stack);
			assert.equal(stack.pop(), 1n);

			stack = initStack([0n, 9n, 4n]);
			op.execute(stack);
			assert.equal(stack.pop(), 2n);

			stack = initStack([1n, 0n, 2n]);
			op.execute(stack);
			assert.equal(stack.pop(), 9223372036854775808n);
		});

		it("Divw opcode unhappy cases", () => {
			const op = new Divw([], 0);

			// div by Zero
			stack = initStack([0n, 1n, 0n]);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ZERO_DIV);

			// overflow
			stack = initStack([2n, 1n, 1n]);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW);

			stack = initStack([2n, 0n, 2n]);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW);
		});

		it("Bsqrt opcode happy cases", () => {
			const op = new Bsqrt([], 0);
			// should run success for case 64 bytes.
			const inputs = [0n, 1n, 10n, 1n << 32n, BigInt("0x" + "ff".repeat(64))];
			const outputs = [0n, 1n, 3n, 1n << 16n, BigInt("0x" + "ff".repeat(32))];

			inputs.forEach((number, index) => {
				stack = initStack([bigintToBigEndianBytes(number)]);
				op.execute(stack);
				assert.deepEqual(stack.pop(), bigintToBigEndianBytes(outputs[index]));
			});
		});

		it("Bsqrt opcode unhappy cases", () => {
			const op = new Bsqrt([], 0);
			// length of input more than 64
			stack = initStack([bigintToBigEndianBytes(BigInt("0x" + "ff".repeat(100)))]);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.BYTES_LEN_EXCEEDED);
		});

		it("Should calculate correct cost", () => {
			stack.push(bigintToBigEndianBytes(0n));
			const op = new Bsqrt([], 0);
			assert.equal(40, op.execute(stack));
		});
	});

	describe("Tealv6: acct_params_get opcode", function () {
		const stack = new Stack<StackElem>();
		let interpreter: Interpreter;
		let alice: AccountStoreI;
		let bob: AccountStoreI;
		let op: AcctParamsGet;
		const zeroBalanceAddr = "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE";

		this.beforeEach(() => {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			[alice, bob] = interpreter.runtime.defaultAccounts();
			// init tx
			interpreter.runtime.ctx.tx = {
				...TXN_OBJ,
				apat: [
					Buffer.from(decodeAddress(alice.address).publicKey),
					Buffer.from(decodeAddress(zeroBalanceAddr).publicKey),
				],
			};
			interpreter.tealVersion = MaxTEALVersion;
			interpreter.runtime.ctx.gtxs = [TXN_OBJ];
			interpreter.tealVersion = 6;
			stack.push(decodeAddress(alice.address).publicKey);
		});

		it("Should return balance", () => {
			op = new AcctParamsGet(["AcctBalance"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n); // balance > 0
			assert.equal(stack.pop(), alice.balance());
		});

		it("Should return min balance", () => {
			op = new AcctParamsGet(["AcctMinBalance"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n); // balance > 0
			assert.equal(stack.pop(), BigInt(alice.minBalance));
		});

		it("Should return Auth Address", () => {
			op = new AcctParamsGet(["AcctAuthAddr"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n); // balance > 0
			assert.deepEqual(stack.pop(), ZERO_ADDRESS);
		});

		it("Shoud return Auth Address - rekey case", () => {
			// set spend key for alice is bob
			alice.rekeyTo(bob.address);
			interpreter.runtime.ctx.state.accounts.set(alice.address, alice);
			op = new AcctParamsGet(["AcctAuthAddr"], 1, interpreter);
			op.execute(stack);
			assert.equal(stack.pop(), 1n); // balance > 0
			assert.deepEqual(stack.pop(), decodeAddress(bob.address).publicKey);
		});

		it("Should return balance with account own zero balance", () => {
			op = new AcctParamsGet(["AcctBalance"], 1, interpreter);
			stack.push(decodeAddress(zeroBalanceAddr).publicKey);
			op.execute(stack);
			assert.equal(stack.pop(), 0n); // balance = 0
			assert.equal(stack.pop(), 0n);
		});

		it("Should return min balance with account own zero balance", () => {
			op = new AcctParamsGet(["AcctMinBalance"], 1, interpreter);
			stack.push(decodeAddress(zeroBalanceAddr).publicKey);
			op.execute(stack);
			assert.equal(stack.pop(), 0n); // balance = 0
			assert.equal(stack.pop(), BigInt(ALGORAND_ACCOUNT_MIN_BALANCE));
		});

		it("Should return Auth Address with account own zero balance", () => {
			op = new AcctParamsGet(["AcctAuthAddr"], 1, interpreter);
			stack.push(decodeAddress(zeroBalanceAddr).publicKey);
			op.execute(stack);
			assert.equal(stack.pop(), 0n); // balance = 0
			assert.deepEqual(stack.pop(), ZERO_ADDRESS);
		});

		it("Should throw error when query unknow field", () => {
			expectRuntimeError(
				() => new AcctParamsGet(["Miles"], 1, interpreter),
				RUNTIME_ERRORS.TEAL.UNKNOWN_ACCT_FIELD
			);
		});

		it("Should throw error if query account not in ref account list", () => {
			op = new AcctParamsGet(["AcctBalance"], 1, interpreter);
			stack.push(decodeAddress(bob.address).publicKey);

			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.ADDR_NOT_FOUND_IN_TXN_ACCOUNT
			);

			// valid address but not in tx accounts list
			stack.push(parsing.stringToBytes("01234567890123456789012345678901"));
			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.ADDR_NOT_FOUND_IN_TXN_ACCOUNT
			);
		});

		it("Should throw error if top element in stack is not an address", () => {
			op = new AcctParamsGet(["AcctBalance"], 1, interpreter);
			stack.push(parsing.stringToBytes("ABCDE"));

			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_ADDR);
		});
	});

	describe("Tealv6: itxnas opcode", function () {
		let stack: Stack<StackElem>;
		let interpreter: Interpreter;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
			interpreter = new Interpreter();
			interpreter.tealVersion = 6;
			interpreter.innerTxnGroups = [[TXN_OBJ, { ...TXN_OBJ, fee: 1000 }]];
		});

		it("Should succeed: query data use itxnas", () => {
			const op = new ITxnas(["Accounts"], 1, interpreter);
			stack.push(1n);
			op.execute(stack);

			assert.deepEqual(stack.pop(), TXN_OBJ.apat[0]);
		});

		it("Should fail: not any inner tx submited", () => {
			interpreter.innerTxnGroups = [];
			const op = new ITxnas(["Accounts"], 1, interpreter);
			stack.push(1n);
			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.NO_INNER_TRANSACTION_AVAILABLE
			);
		});

		it("Should fail: stack empty", () => {
			const op = new ITxnas(["Accounts"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});
	});

	describe("Tealv5: itxn opcode", function () {
		let stack: Stack<StackElem>;
		let interpreter: Interpreter;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.tx = TXN_OBJ;
			interpreter.tealVersion = 5;
			interpreter.innerTxnGroups = [[TXN_OBJ, { ...TXN_OBJ, fee: 1000 }]];
			interpreter.runtime.ctx.state.txReceipts.set(TXN_OBJ.txID, {
				txn: interpreter.runtime.ctx.tx,
				txID: TXN_OBJ.txID,
				logs: [parsing.stringToBytes("Hello")],
			});
		});

		it("Should put on top of the stack logs from innerTx", () => {
			const op = new ITxn(["Logs", "0"], 1, interpreter);
			op.execute(stack);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("Hello"));
		});

		it("Should throw an error, no inner transaction", () => {
			interpreter.innerTxnGroups = [];
			const op = new ITxn(["Logs", "0"], 1, interpreter);
			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.NO_INNER_TRANSACTION_AVAILABLE
			);
		});

		it("Should throw an error, no inner transaction", () => {
			interpreter.innerTxnGroups = [];
			const op = new ITxn(["NumLogs"], 1, interpreter);
			expectRuntimeError(
				() => op.execute(stack),
				RUNTIME_ERRORS.TEAL.NO_INNER_TRANSACTION_AVAILABLE
			);
		});

		it("Should put the number of logs on top of the stack", () => {
			const op = new ITxn(["NumLogs"], 1, interpreter);
			op.execute(stack);
			assert.equal(1n, stack.pop());
		});
	});

	describe("Logs", function () {
		let stack: Stack<StackElem>;
		let interpreter: Interpreter;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.runtime.ctx.tx = TXN_OBJ;
			interpreter.tealVersion = 6;
			interpreter.innerTxnGroups = [[TXN_OBJ, { ...TXN_OBJ, fee: 1000 }]];
			interpreter.runtime.ctx.state.txReceipts.set(TXN_OBJ.txID, {
				txn: interpreter.runtime.ctx.tx,
				txID: TXN_OBJ.txID,
				logs: [parsing.stringToBytes("Monty"), parsing.stringToBytes("Python")],
			});
		});

		it("Should put on top of the stack log from group transaction", () => {
			const op = new Gitxna(["1", "Logs", "0"], 1, interpreter);
			op.execute(stack);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("Monty"));
		});

		it("Should throw an error index out of bound", () => {
			const op = new Gitxna(["1", "Logs", "2"], 1, interpreter);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INDEX_OUT_OF_BOUND);
		});

		it("Should put on top of stack log from group transaction", () => {
			stack.push(1n);
			const op = new Gitxnas(["1", "Logs"], 1, interpreter);
			op.execute(stack);
			assert.deepEqual(stack.pop(), parsing.stringToBytes("Python"));
		});
	});

	describe("Tealv7: base64Decode opcode", function () {
		let stack: Stack<StackElem>;
		const encoded64BaseStd = "YWJjMTIzIT8kKiYoKSctPUB+";
		const encoded64BaseUrl = "YWJjMTIzIT8kKiYoKSctPUB-";
		const decoded64Base = "abc123!?$*&()'-=@~";
		const toPushStd = Buffer.from(encoded64BaseStd, "utf-8");
		const toPushUrl = Buffer.from(encoded64BaseUrl, "utf-8");
		const expectedBytes = new Uint8Array(Buffer.from(decoded64Base, "utf-8"));

		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("Should decode base64 encoded data and push it to stack", () => {
			stack.push(toPushUrl);
			const opUrl = new Base64Decode(["URLEncoding"], 0);
			opUrl.execute(stack);
			assert.deepEqual(expectedBytes, stack.pop());
			stack.push(toPushStd);
			const opStd = new Base64Decode(["StdEncoding"], 0);
			opStd.execute(stack);
			assert.deepEqual(expectedBytes, stack.pop());
		});

		it("Should throw an error when last stack element is not base64 encoded", () => {
			stack.push(new Uint8Array(Buffer.from(encoded64BaseUrl, "utf-8")));
			const op = new Base64Decode(["StdEncoding"], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_BASE64);
		});

		it("Should throw an error when last stack element is not base64Url encoded", () => {
			stack.push(new Uint8Array(Buffer.from(encoded64BaseStd, "utf-8")));
			const op = new Base64Decode(["URLEncoding"], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.INVALID_BASE64URL);
		});

		it("Should throw an error when the stack is empty", () => {
			const op = new Base64Decode(["StdEncoding"], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH);
		});

		it("Should throw an error when argument not in bound", () => {
			stack.push(toPushStd);
			expectRuntimeError(
				() => new Base64Decode(["3"], 0),
				RUNTIME_ERRORS.TEAL.UNKNOWN_ENCODING
			);
		});

		it("Should calculate the correct cost", () => {
			let toPush = Buffer.from("", "utf-8");
			stack.push(toPush);
			let op = new Base64Decode(["URLEncoding"], 0);
			let cost = op.execute(stack);
			assert.deepEqual(1, cost); // base64_decode cost = 1

			toPush = Buffer.from(
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
				"utf-8"
			);
			stack.push(toPush);
			op = new Base64Decode(["URLEncoding"], 0);
			cost = op.execute(stack);
			assert.deepEqual(5, cost); // base64_decode cost = 5 (64 bytes -> 1 + 64/16)

			toPush = Buffer.from(
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01234567",
				"utf-8"
			);
			stack.push(toPush);
			op = new Base64Decode(["URLEncoding"], 0);
			cost = op.execute(stack);
			assert.deepEqual(5, cost); // base64_decode cost = 5 (60 bytes -> 1 + ceil(60/16))

			toPush = Buffer.from(
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_AA==",
				"utf-8"
			);
			stack.push(toPush);
			op = new Base64Decode(["URLEncoding"], 0);
			cost = op.execute(stack);
			assert.deepEqual(6, cost); // base64_decode cost = 6 (68 bytes -> 1 + ceil(68/16))
		});

		it("Should throw an error when argument not provided", () => {
			stack.push(toPushStd);
			expectRuntimeError(() => new Base64Decode([], 0), RUNTIME_ERRORS.TEAL.ASSERT_LENGTH);
		});
	});

	describe("Tealv7: replace2 opcode", function () {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("Should replace bytes correctly", () => {
			const original = "0x11111111";
			const replace = "0x2222";
			let hexStr = "0x22221111";
			let expectedBytes = strHexToBytes(hexStr);

			stack.push(strHexToBytes(original));
			stack.push(strHexToBytes(replace));
			let op = new Replace2(["0"], 0);
			op.execute(stack);
			assert.deepEqual(stack.pop(), expectedBytes);

			hexStr = "0x11222211";
			expectedBytes = strHexToBytes(hexStr);
			stack.push(strHexToBytes(original));
			stack.push(strHexToBytes(replace));
			op = new Replace2(["1"], 0);
			op.execute(stack);
			assert.deepEqual(stack.pop(), expectedBytes);

			//push a random bytes to stack for testing if the data in stack remain the same
			const remainBytes = "0x112233";
			const expectedRemain = strHexToBytes(remainBytes);
			stack.push(strHexToBytes(remainBytes)); 

			hexStr = "0x11112222";
			expectedBytes = strHexToBytes(hexStr);
			stack.push(strHexToBytes(original));
			stack.push(strHexToBytes(replace));
			op = new Replace2(["2"], 0);
			op.execute(stack);
			assert.deepEqual(stack.pop(), expectedBytes);
			
			assert.deepEqual(stack.pop(), expectedRemain); //check if the remaining data in the stack are stay the same
		});

		it("Should throw an error when argument not provided", () => {
			expectRuntimeError(() => new Replace2([], 0), RUNTIME_ERRORS.TEAL.ASSERT_LENGTH);
		});

		it("Should throw error for wrong index replace", () => {
			const original = "0x11111111";
			const replace = "0x2222";
			stack.push(strHexToBytes(original));
			stack.push(strHexToBytes(replace));
			const op = new Replace2(["3"], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.BYTES_REPLACE_ERROR);
		});
	});

	describe("Tealv7: replace3 opcode", function () {
		let stack: Stack<StackElem>;
		this.beforeEach(() => {
			stack = new Stack<StackElem>();
		});

		it("Should replace bytes correctly", () => {
			const original = "0x11111111";
			const replace = "0x2222";
			let hexStr = "0x22221111";
			let expectedBytes = strHexToBytes(hexStr);

			stack.push(strHexToBytes(original));
			stack.push(0n);
			stack.push(strHexToBytes(replace));
			let op = new Replace3([], 0);
			op.execute(stack);
			assert.deepEqual(stack.pop(), expectedBytes);

			hexStr = "0x11222211";
			expectedBytes = strHexToBytes(hexStr);
			stack.push(strHexToBytes(original));
			stack.push(1n);
			stack.push(strHexToBytes(replace));
			op = new Replace3([], 0);
			op.execute(stack);
			assert.deepEqual(stack.pop(), expectedBytes);

			//push a random bytes to stack for testing if the data in stack remain the same
			const remainBytes = "0x112233";
			const expectedRemain = strHexToBytes(remainBytes);
			stack.push(strHexToBytes(remainBytes)); 

			hexStr = "0x11112222";
			expectedBytes = strHexToBytes(hexStr);
			stack.push(strHexToBytes(original));
			stack.push(2n);
			stack.push(strHexToBytes(replace));
			op = new Replace3([], 0);
			op.execute(stack);
			assert.deepEqual(stack.pop(), expectedBytes);

			assert.deepEqual(stack.pop(), expectedRemain); //check if the remaining data in the stack are stay the same
		});

		it("Should throw error for wrong index replace", () => {
			const original = "0x11111111";
			const replace = "0x2222";
			stack.push(strHexToBytes(original));
			stack.push(3n);
			stack.push(strHexToBytes(replace));
			const op = new Replace3([], 0);
			expectRuntimeError(() => op.execute(stack), RUNTIME_ERRORS.TEAL.BYTES_REPLACE_ERROR);
		});
	});

	describe("sha3_256", function () {
		const stack = new Stack<StackElem>();

		it("should return correct hash for sha3_256", function () {
			stack.push(parsing.stringToBytes("ALGORAND"));
			const op = new Sha3_256([], 1);
			op.execute(stack);

			// http://emn178.github.io/online-tools/sha3_256.html
			const expected = Buffer.from(
				"ae39517df229f45df862c060e693c0e69691dac70fa65605a62fabad8029a4e7",
				"hex"
			);

			const top = stack.pop();
			assert.deepEqual(expected, top);
		});

		it(
			"should throw invalid type error Sha3_256(Expected bytes but got bigint at line 1)",
			execExpectError(
				stack,
				[1n],
				new Sha3_256([], 1),
				RUNTIME_ERRORS.TEAL.INVALID_TYPE
			)
		);

		it(
			"should throw error with sha3_256 if stack is below min length(at least 1 element in Stack)",
			execExpectError(
				stack,
				[],
				new Sha3_256([], 1),
				RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
			)
		);

		it("Should return correct cost", () => {
			stack.push(parsing.stringToBytes("MESSAGE"));
			const op = new Sha3_256([], 1);
			assert.equal(130, op.execute(stack));
		});
	});

});
