/* eslint sonarjs/no-identical-functions: 0 */
import { parsing, tx as webTx, types } from "@algo-builder/web";
import algosdk, {
	decodeAddress,
	decodeUint64,
	encodeAddress,
	encodeUint64,
	getApplicationAddress,
	isValidAddress,
	modelsv2,
	SignedTransaction,
	Transaction,
	verifyBytes,
} from "algosdk";
import chalk from "chalk";
import { ec as EC } from "elliptic";
import { Hasher, Message, sha256 } from "js-sha256";
import { sha512_256 } from "js-sha512";
import cloneDeep from "lodash.clonedeep";
import { Keccak, SHA3 } from "sha3";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { compareArray } from "../lib/compare";
import {
	AcctParamQueryFields,
	ALGORAND_MAX_LOGS_COUNT,
	ALGORAND_MAX_LOGS_LENGTH,
	AppParamDefined,
	AssetParamMap,
	GlobalFields,
	ITxArrFields,
	MathOp,
	MAX_APP_PROGRAM_COST,
	MAX_CONCAT_SIZE,
	MAX_INNER_TRANSACTIONS,
	MAX_INPUT_BYTE_LEN,
	MAX_OUTPUT_BYTE_LEN,
	MAX_UINT64,
	MAX_UINT128,
	MaxTEALVersion,
	OpGasCost,
	TransactionTypeEnum,
	TxArrFields,
	ZERO_ADDRESS,
} from "../lib/constants";
import { addInnerTransaction, calculateInnerTxCredit, setInnerTxField } from "../lib/itxn";
import { bigintSqrt } from "../lib/math";
import {
	assertBase64,
	assertBase64Url,
	assertLen,
	assertNumber,
	assertOnlyDigits,
	bigEndianBytesToBigInt,
	bigintToBigEndianBytes,
	convertToBuffer,
	convertToString,
	getEncoding,
	parseBinaryStrToBigInt,
} from "../lib/parsing";
import { Stack } from "../lib/stack";
import {
	encTxToExecParams,
	executeITxn,
	isEncTxApplicationCall,
	txAppArg,
	txnSpecByField,
} from "../lib/txn";
import { mockSuggestedParams } from "../mock/tx";
import {
	DecodingMode,
	EncodingType,
	EncTx,
	ExecutionMode,
	StackElem,
	TEALStack,
	TxnType,
	TxOnComplete,
} from "../types";
import { Interpreter } from "./interpreter";
import { Op } from "./opcode";

// Opcodes reference link: https://developer.algorand.org/docs/reference/teal/opcodes/

// Store TEAL version
// push to stack [...stack]
export class Pragma extends Op {
	readonly version: number;
	readonly line: number;
	/**
	 * Store Pragma version
	 * @param args Expected arguments: ["version", version number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 2, line);
		if (this.line > 1) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.PRAGMA_NOT_AT_FIRST_LINE, { line: line });
		}
		if (args[0] === "version" && Number(args[1]) <= MaxTEALVersion) {
			this.version = Number(args[1]);
			interpreter.tealVersion = this.version;
		} else {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.PRAGMA_VERSION_ERROR, {
				expected: MaxTEALVersion,
				got: args.join(" "),
				line: line,
			});
		}
	}

	// Returns Pragma version
	getVersion(): number {
		return this.version;
	}

	computeCost(): number {
		return 0;
	}

	execute(_stack: TEALStack): number {
		return this.computeCost();
	} /* eslint-disable-line @typescript-eslint/no-empty-function */
}

// pops string([]byte) from stack and pushes it's length to stack
// push to stack [...stack, bigint]
export class Len extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBytes(stack.pop(), this.line);
		stack.push(BigInt(last.length));
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their sum(last + prev) to stack
// panics on overflow (result > max_unit64)
// push to stack [...stack, bigint]
export class Add extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		const result = prev + last;
		this.checkOverflow(result, this.line, MAX_UINT64);
		stack.push(result);
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their diff(last - prev) to stack
// panics on underflow (result < 0)
// push to stack [...stack, bigint]
export class Sub extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		const result = prev - last;
		this.checkUnderflow(result, this.line);
		stack.push(result);
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their division(last / prev) to stack
// panics if prev == 0
// push to stack [...stack, bigint]
export class Div extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (last === 0n) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
		}
		stack.push(prev / last);
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their mult(last * prev) to stack
// panics on overflow (result > max_unit64)
// push to stack [...stack, bigint]
export class Mul extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		const result = prev * last;
		this.checkOverflow(result, this.line, MAX_UINT64);
		stack.push(result);
		return this.computeCost();
	}
}

// pushes argument[N] from argument array to stack
// push to stack [...stack, bytes]
export class Arg extends Op {
	index: number;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Gets the argument value from interpreter.args array.
	 * store the value in _arg variable
	 * @param args Expected arguments: [argument number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		assertOnlyDigits(args[0], this.line);

		this.index = Number(args[0]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		// get args from context
		const args = this.interpreter.runtime.ctx.args ?? [];
		this.checkIndexBound(this.index, args, this.line);
		const argN = this.assertBytes(args?.[this.index], this.line);
		stack.push(argN);
		return this.computeCost();
	}
}

// load block of byte-array constants
// push to stack [...stack]
export class Bytecblock extends Op {
	readonly bytecblock: Uint8Array[];
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Store blocks of bytes in bytecblock
	 * @param args Expected arguments: [bytecblock] // Ex: ["value1" "value2"]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		const bytecblock: Uint8Array[] = [];
		for (const val of args) {
			bytecblock.push(parsing.stringToBytes(val));
		}

		this.interpreter = interpreter;
		this.bytecblock = bytecblock;
	}

	execute(_stack: TEALStack): number {
		this.assertArrLength(this.bytecblock, this.line);
		this.interpreter.bytecblock = this.bytecblock;
		return this.computeCost();
	}
}

// push bytes constant from bytecblock to stack by index
// push to stack [...stack, bytes]
export class Bytec extends Op {
	readonly index: number;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Sets index according to the passed arguments
	 * @param args Expected arguments: [byteblock index number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);

		this.index = Number(args[0]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.checkIndexBound(this.index, this.interpreter.bytecblock, this.line);
		const bytec = this.assertBytes(this.interpreter.bytecblock[this.index], this.line);
		stack.push(bytec);
		return this.computeCost();
	}
}

// load block of uint64 constants
// push to stack [...stack]
export class Intcblock extends Op {
	readonly intcblock: Array<bigint>;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores block of integer in intcblock
	 * @param args Expected arguments: [integer block] // Ex: [100 200]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		const intcblock: Array<bigint> = [];
		for (const val of args) {
			assertOnlyDigits(val, this.line);
			intcblock.push(BigInt(val));
		}

		this.interpreter = interpreter;
		this.intcblock = intcblock;
	}

	execute(_stack: TEALStack): number {
		this.assertArrLength(this.intcblock, this.line);
		this.interpreter.intcblock = this.intcblock;
		return this.computeCost();
	}
}

// push value from uint64 intcblock to stack by index
// push to stack [...stack, bigint]
export class Intc extends Op {
	readonly index: number;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Sets index according to the passed arguments
	 * @param args Expected arguments: [intcblock index number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);

		this.index = Number(args[0]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.checkIndexBound(this.index, this.interpreter.intcblock, this.line);
		const intc = this.assertBigInt(this.interpreter.intcblock[this.index], this.line);
		stack.push(intc);
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their modulo(last % prev) to stack
// Panic if B == 0.
// push to stack [...stack, bigint]
export class Mod extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (last === 0n) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
		}
		stack.push(prev % last);
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-or(last | prev) to stack
// push to stack [...stack, bigint]
export class BitwiseOr extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		stack.push(prev | last);
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-and(last & prev) to stack
// push to stack[...stack, bigint]
export class BitwiseAnd extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		stack.push(prev & last);
		return this.computeCost();
	}
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-xor(last ^ prev) to stack
// push to stack [...stack, bigint]
export class BitwiseXor extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		stack.push(prev ^ last);
		return this.computeCost();
	}
}

// pop unit64 from stack and push it's bitwise-invert(~last) to stack
// push to stack [...stack, bigint]
export class BitwiseNot extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		stack.push(~last);
		return this.computeCost();
	}
}

// pop last value from the stack and store to scratch space
// push to stack [...stack]
export class Store extends Op {
	readonly index: number;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores index number according to the passed arguments
	 * @param args Expected arguments: [index number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 1, this.line);
		assertOnlyDigits(args[0], this.line);

		this.index = Number(args[0]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.checkIndexBound(this.index, this.interpreter.scratch, this.line);
		this.assertMinStackLen(stack, 1, this.line);
		const top = stack.pop();
		this.interpreter.scratch[this.index] = top;
		return this.computeCost();
	}
}

// copy ith value from scratch space to the stack
// push to stack [...stack, bigint/bytes]
export class Load extends Op {
	index: number;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores index number according to the passed arguments.
	 * @param args Expected arguments: [index number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 1, this.line);
		assertOnlyDigits(args[0], this.line);

		this.index = Number(args[0]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.checkIndexBound(this.index, this.interpreter.scratch, this.line);
		stack.push(this.interpreter.scratch[this.index]);
		return this.computeCost();
	}
}

// err opcode : Error. Panic immediately.
// push to stack [...stack]
export class Err extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(_stack: TEALStack): number {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR, { line: this.line });
	}
}

abstract class HashOp extends Op {
	readonly line: number;
	readonly interpreter: Interpreter;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.interpreter = interpreter;
		assertLen(args.length, 0, line);
	}

	_execute(stack: TEALStack, hasher: Hasher): number {
		this.assertMinStackLen(stack, 1, this.line);
		const val = this.assertBytes(stack.pop(), this.line) as Message;
		hasher.update(val);
		const arrByte = Uint8Array.from(hasher.digest());
		stack.push(arrByte);
		return this.computeCost();
	}
}

abstract class HashOpSHA3 extends Op {
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	_execute(stack: TEALStack, hasher: Keccak): number {
		this.assertMinStackLen(stack, 1, this.line);
		const top = this.assertBytes(stack.pop(), this.line);
		hasher.update(convertToString(top));
		const arrByte = Uint8Array.from(hasher.digest());
		stack.push(arrByte);
		return this.computeCost();
	}
}

// SHA256 hash of value X, yields [32]byte
// push to stack [...stack, bytes]
export class Sha256 extends HashOp {
	computeCost(): number {
		return OpGasCost[this.interpreter.tealVersion]["sha256"];
	}
	execute(stack: TEALStack): number {
		return super._execute(stack, sha256.create());
	}
}

// SHA512_256 hash of value X, yields [32]byte
// push to stack [...stack, bytes]
export class Sha512_256 extends HashOp {
	computeCost(): number {
		return OpGasCost[this.interpreter.tealVersion]["sha512_256"];
	}
	execute(stack: TEALStack): number {
		return super._execute(stack, sha512_256.create());
	}
}

// Keccak256 hash of value X, yields [32]byte
// https://github.com/phusion/node-sha3#example-2
// push to stack [...stack, bytes]
export class Keccak256 extends HashOpSHA3 {

	readonly interpreter: Interpreter;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	 constructor(args: string[], line: number, interpreter: Interpreter) {
		super(args, line);
		this.interpreter = interpreter;
	}

	computeCost(): number {
		return OpGasCost[this.interpreter.tealVersion]["keccak256"];
	}
	execute(stack: TEALStack): number {
		return super._execute(stack, new Keccak(256));
	}
}

// SHA3_256 hash of value A, yields [32]byte
// https://github.com/phusion/node-sha3#generating-a-sha3-512-hash
// push to stack [...stack, bytes]
export class Sha3_256 extends HashOpSHA3 {
	computeCost(): number {
		return OpGasCost[7]["sha3_256"];
	}
	execute(stack: TEALStack): number {
		return super._execute(stack, new SHA3(256));
	}
}

// for (data A, signature B, pubkey C) verify the signature of
// ("ProgData" || program_hash || data) against the pubkey => {0 or 1}
// push to stack [...stack, bigint]
export class Ed25519verify extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	computeCost(): number {
		return OpGasCost[1]["ed25519verify"];
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const pubkey = this.assertBytes(stack.pop(), this.line);
		const signature = this.assertBytes(stack.pop(), this.line);
		const data = this.assertBytes(stack.pop(), this.line);

		const addr = encodeAddress(pubkey);
		const isValid = verifyBytes(data, signature, addr);
		if (isValid) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// If A < B pushes '1' else '0'
// push to stack [...stack, bigint]
export class LessThan extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (prev < last) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// If A > B pushes '1' else '0'
// push to stack [...stack, bigint]
export class GreaterThan extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (prev > last) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// If A <= B pushes '1' else '0'
// push to stack [...stack, bigint]
export class LessThanEqualTo extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (prev <= last) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// If A >= B pushes '1' else '0'
// push to stack [...stack, bigint]
export class GreaterThanEqualTo extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (prev >= last) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// If A && B is true pushes '1' else '0'
// push to stack [...stack, bigint]
export class And extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (last && prev) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// If A || B is true pushes '1' else '0'
// push to stack [...stack, bigint]
export class Or extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		const prev = this.assertBigInt(stack.pop(), this.line);
		if (prev || last) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// If A == B pushes '1' else '0'
// push to stack [...stack, bigint]
export class EqualTo extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = stack.pop();
		const prev = stack.pop();
		if (typeof last !== typeof prev) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, {
				expected: typeof prev,
				actual: typeof last,
				line: this.line,
			});
		}
		if (typeof last === "bigint") {
			stack = this.pushBooleanCheck(stack, last === prev);
		} else {
			stack = this.pushBooleanCheck(
				stack,
				compareArray(this.assertBytes(last, this.line), this.assertBytes(prev, this.line))
			);
		}
		return this.computeCost();
	}
}

// If A != B pushes '1' else '0'
// push to stack [...stack, bigint]
export class NotEqualTo extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const last = stack.pop();
		const prev = stack.pop();
		if (typeof last !== typeof prev) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, {
				expected: typeof prev,
				actual: typeof last,
				line: this.line,
			});
		}
		if (typeof last === "bigint") {
			stack = this.pushBooleanCheck(stack, last !== prev);
		} else {
			stack = this.pushBooleanCheck(
				stack,
				!compareArray(this.assertBytes(last, this.line), this.assertBytes(prev, this.line))
			);
		}
		return this.computeCost();
	}
}

// X == 0 yields 1; else 0
// push to stack [...stack, bigint]
export class Not extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);
		if (last === 0n) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// converts uint64 X to big endian bytes
// push to stack [...stack, big endian bytes]
export class Itob extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const uint64 = this.assertBigInt(stack.pop(), this.line);
		stack.push(encodeUint64(uint64));
		return this.computeCost();
	}
}

// converts bytes X as big endian to uint64
// btoi panics if the input is longer than 8 bytes.
// push to stack [...stack, bigint]
export class Btoi extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const bytes = this.assertBytes(stack.pop(), this.line);
		const uint64 = decodeUint64(bytes, DecodingMode.BIGINT);
		stack.push(uint64);
		return this.computeCost();
	}
}

// A plus B out to 128-bit long result as sum (top) and carry-bit uint64 values on the stack
// push to stack [...stack, bigint]
export class Addw extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const valueA = this.assertBigInt(stack.pop(), this.line);
		const valueB = this.assertBigInt(stack.pop(), this.line);
		let valueC = valueA + valueB;

		if (valueC > MAX_UINT64) {
			valueC -= MAX_UINT64;
			stack.push(1n);
			stack.push(valueC - 1n);
		} else {
			stack.push(0n);
			stack.push(valueC);
		}
		return this.computeCost();
	}
}

// A times B out to 128-bit long result as low (top) and high uint64 values on the stack
// push to stack [...stack, bigint]
export class Mulw extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const valueA = this.assertBigInt(stack.pop(), this.line);
		const valueB = this.assertBigInt(stack.pop(), this.line);
		const result = valueA * valueB;

		const low = result & MAX_UINT64;
		this.checkOverflow(low, this.line, MAX_UINT64);

		const high = result >> BigInt("64");
		this.checkOverflow(high, this.line, MAX_UINT64);

		stack.push(high);
		stack.push(low);

		return this.computeCost();
	}
}

// A,B / C. Fail if C == 0 or if result overflows.
// The notation A,B indicates that A and B are interpreted as a uint128 value,
// with A as the high uint64 and B the low.
// push to stack [...stack, bigint]
// Availability: v6
export class Divw extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const valueC = this.assertBigInt(stack.pop(), this.line);
		const valueB = this.assertBigInt(stack.pop(), this.line);
		const valueA = this.assertBigInt(stack.pop(), this.line);

		if (valueC === 0n) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
		}

		const result = ((valueA << 64n) + valueB) / valueC;

		this.checkOverflow(result, this.line, MAX_UINT64);

		stack.push(result);

		return this.computeCost();
	}
}
// Pop one element from stack
// [...stack] // pop value.
export class Pop extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		stack.pop();
		return this.computeCost();
	}
}

// duplicate last value on stack
// push to stack [...stack, duplicate value]
export class Dup extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const lastValue = stack.pop();

		stack.push(lastValue);
		stack.push(lastValue);

		return this.computeCost();
	}
}

// duplicate two last values on stack: A, B -> A, B, A, B
// push to stack [...stack, B, A, B, A]
export class Dup2 extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const lastValueA = stack.pop();
		const lastValueB = stack.pop();
		stack.push(lastValueB);
		stack.push(lastValueA);
		stack.push(lastValueB);
		stack.push(lastValueA);
		return this.computeCost();
	}
}

// pop two byte strings A and B and join them, push the result
// concat panics if the result would be greater than 4096 bytes.
// push to stack [...stack, string]
export class Concat extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const valueA = this.assertBytes(stack.pop(), this.line);
		const valueB = this.assertBytes(stack.pop(), this.line);

		if (valueA.length + valueB.length > MAX_CONCAT_SIZE) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.CONCAT_ERROR, { line: this.line });
		}
		const c = new Uint8Array(valueB.length + valueA.length);
		c.set(valueB);
		c.set(valueA, valueB.length);
		stack.push(c);
		return this.computeCost();
	}
}

// pop last byte string X. For immediate values in 0..255 M and N:
// extract last range of bytes from it starting at M up to but not including N,
// push the substring result. If N < M, or either is larger than the string length,
// the program fails
// push to stack [...stack, substring]
export class Substring extends Op {
	readonly start: bigint;
	readonly end: bigint;
	readonly line: number;

	/**
	 * Stores values of `start` and `end` according to the passed arguments.
	 * @param args Expected arguments: [start index number, end index number]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 2, line);
		assertOnlyDigits(args[0], line);
		assertOnlyDigits(args[1], line);

		this.start = BigInt(args[0]);
		this.end = BigInt(args[1]);
	}

	execute(stack: TEALStack): number {
		const end = this.assertUint8(this.end, this.line);
		const start = this.assertUint8(this.start, this.line);
		const byteString = this.assertBytes(stack.pop(), this.line);
		const subString = this.subString(byteString, start, end, this.line);
		stack.push(subString);
		return this.computeCost();
	}
}

// pop a byte-array A and two integers B and C.
// Extract a range of bytes from A starting at B up to but not including C,
// push the substring result. If C < B, or either is larger than the array length,
// the program fails
// push to stack [...stack, substring]
export class Substring3 extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		const end = this.assertBigInt(stack.pop(), this.line);
		const start = this.assertBigInt(stack.pop(), this.line);
		const byteString = this.assertBytes(stack.pop(), this.line);
		const subString = this.subString(byteString, start, end, this.line);
		stack.push(subString);
		return this.computeCost();
	}
}

// push field from current transaction to stack
// push to stack [...stack, transaction field]
export class Txn extends Op {
	readonly field: string;
	readonly idx: number | undefined;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Set transaction field according to the passed arguments
	 * @param args Expected arguments: [transaction field]
	 * // Note: Transaction field is expected as string instead of number.
	 * For ex: `Fee` is expected and `0` is not expected.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.idx = undefined;

		this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);
		if (TxArrFields[interpreter.tealVersion].has(args[0])) {
			// eg. txn Accounts 1
			assertLen(args.length, 2, line);
			assertOnlyDigits(args[1], line);
			this.idx = Number(args[1]);
		} else {
			assertLen(args.length, 1, line);
		}
		this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);

		this.field = args[0]; // field
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		let result;
		if (this.idx !== undefined) {
			// if field is an array use txAppArg (with "Accounts"/"ApplicationArgs"/'Assets'..)
			result = txAppArg(
				this.field,
				this.interpreter.runtime.ctx.tx,
				this.idx,
				this,
				this.interpreter,
				this.line
			);
		} else {
			result = txnSpecByField(
				this.field,
				this.interpreter.runtime.ctx.tx,
				this.interpreter.runtime.ctx.gtxs,
				this.interpreter
			);
		}
		stack.push(result);
		return this.computeCost();
	}
}

// push field to the stack from a transaction in the current transaction group
// If this transaction is i in the group, gtxn i field is equivalent to txn field.
// push to stack [...stack, transaction field]
export class Gtxn extends Op {
	readonly field: string;
	readonly txFieldIdx: number | undefined;
	readonly interpreter: Interpreter;
	readonly line: number;
	protected txIdx: number;
	// use to store group txn we want to query
	// can change it to inner group txn
	groupTxn: EncTx[];
	/**
	 * Sets `field`, `txIdx` values according to the passed arguments.
	 * @param args Expected arguments: [transaction group index, transaction field]
	 * // Note: Transaction field is expected as string instead of number.
	 * For ex: `Fee` is expected and `0` is not expected.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.txFieldIdx = undefined;
		if (TxArrFields[interpreter.tealVersion].has(args[1])) {
			assertLen(args.length, 3, line); // eg. gtxn 0 Accounts 1
			assertOnlyDigits(args[2], line);
			this.txFieldIdx = Number(args[2]);
		} else {
			assertLen(args.length, 2, line);
		}
		assertOnlyDigits(args[0], line);
		this.assertTxFieldDefined(args[1], interpreter.tealVersion, line);
		this.txIdx = Number(args[0]); // transaction group index
		this.field = args[1]; // field
		this.groupTxn = interpreter.runtime.ctx.gtxs;
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.assertUint8(BigInt(this.txIdx), this.line);
		this.checkIndexBound(this.txIdx, this.groupTxn, this.line);
		let result;
		const tx = this.groupTxn[this.txIdx]; // current tx
		if (this.txFieldIdx !== undefined) {
			result = txAppArg(this.field, tx, this.txFieldIdx, this, this.interpreter, this.line);
		} else {
			result = txnSpecByField(this.field, tx, this.groupTxn, this.interpreter);
		}
		stack.push(result);
		return this.computeCost();
	}
}

/**
 * push value of an array field from current transaction to stack
 * push to stack [...stack, value of an array field ]
 * NOTE:
 * a) for arg="Accounts" index 0 means sender's address, and index 1 means first address
 *    from accounts array (eg. txna Accounts 1: will push 1st address from Accounts[] to stack)
 * b) for arg="ApplicationArgs" index 0 means first argument for application array (normal indexing)
 */
export class Txna extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;
	readonly field: string;
	fieldIdx: number;

	/**
	 * Sets `field` and `fieldIdx` values according to passed arguments.
	 * @param args Expected arguments: [transaction field, transaction field array index]
	 *   Note: Transaction field is expected as string instead of a number.
	 *   For ex: `"Fee"` rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		assertLen(args.length, 2, line);
		super();
		this.line = line;
		assertOnlyDigits(args[1], line);
		this.assertTxArrFieldDefined(args[0], interpreter.tealVersion, line);

		this.field = args[0]; // field
		this.fieldIdx = Number(args[1]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		const result = txAppArg(
			this.field,
			this.interpreter.runtime.ctx.tx,
			this.fieldIdx,
			this,
			this.interpreter,
			this.line
		);
		stack.push(result);
		return this.computeCost();
	}
}

/// placeholder values
const mockTxIdx = "100";
const mockTxFieldIdx = "200";
const mockScratchIndex = "100";
/**
 * push value of a field to the stack from a transaction in the current transaction group
 * push to stack [...stack, value of field]
 * NOTE: for arg="Accounts" index 0 means sender's address, and index 1 means first address from accounts
 * array (eg. gtxna 0 Accounts 1: will push 1st address from Accounts[](from the 1st tx in group) to stack)
 * b) for arg="ApplicationArgs" index 0 means first argument for application array (normal indexing)
 */
export class Gtxna extends Op {
	readonly field: string;
	readonly interpreter: Interpreter;
	readonly line: number;
	fieldIdx: number; // array index
	groupTxn: EncTx[];
	protected txIdx: number; // transaction group index

	/**
	 * Sets `field`(Transaction Field), `fieldIdx`(Array Index) and
	 * `txIdx`(Transaction Group Index) values according to the passed arguments.
	 * @param args Expected arguments:
	 *   [transaction group index, transaction field, transaction field array index]
	 *   Note: Transaction field is expected as string instead of a number.
	 *   For ex: `"Fee"` rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 3, line);
		assertOnlyDigits(args[0], line);
		assertOnlyDigits(args[2], line);
		this.assertTxArrFieldDefined(args[1], interpreter.tealVersion, line);

		this.txIdx = Number(args[0]); // transaction group index
		this.field = args[1]; // field
		this.fieldIdx = Number(args[2]); // transaction field array index
		this.groupTxn = interpreter.runtime.ctx.gtxs;
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertUint8(BigInt(this.txIdx), this.line);
		this.checkIndexBound(this.txIdx, this.groupTxn, this.line);
		const tx = this.groupTxn[this.txIdx];
		const result = txAppArg(this.field, tx, this.fieldIdx, this, this.interpreter, this.line);
		stack.push(result);
		return this.computeCost();
	}
}

// represents branch name of a new branch
// push to stack [...stack]
export class Label extends Op {
	readonly label: string;
	readonly line: number;

	/**
	 * Sets `label` according to the passed arguments.
	 * @param args Expected arguments: [label]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		assertLen(args.length, 1, line);
		this.label = args[0].split(":")[0];
		this.line = line;
	}

	computeCost(): number {
		return 0;
	}

	execute(_stack: TEALStack): number {
		return this.computeCost();
	}
}

// branch unconditionally to label - Tealv <= 3
// push to stack [...stack]
export class Branch extends Op {
	readonly label: string;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Sets `label` according to the passed arguments.
	 * @param args Expected arguments: [label of branch]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 1, line);
		this.label = args[0];
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(_stack: TEALStack): number {
		this.interpreter.jumpForward(this.label, this.line);

		return this.computeCost();
	}
}

// branch unconditionally to label - TEALv4
// can also jump backward
// push to stack [...stack]
export class Branchv4 extends Branch {
	execute(_stack: TEALStack): number {
		this.interpreter.jumpToLabel(this.label, this.line);
		return this.computeCost();
	}
}

// branch conditionally if top of stack is zero - Teal version <= 3
// push to stack [...stack]
export class BranchIfZero extends Op {
	readonly label: string;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Sets `label` according to the passed arguments.
	 * @param args Expected arguments: [label of branch]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 1, line);
		this.label = args[0];
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);

		if (last === 0n) {
			this.interpreter.jumpForward(this.label, this.line);
		}
		return this.computeCost();
	}
}

// branch conditionally if top of stack is zero - Tealv4
// can jump forward also
// push to stack [...stack]
export class BranchIfZerov4 extends BranchIfZero {
	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);

		if (last === 0n) {
			this.interpreter.jumpToLabel(this.label, this.line);
		}

		return this.computeCost();
	}
}

// branch conditionally if top of stack is non zero
// push to stack [...stack]
export class BranchIfNotZero extends Op {
	readonly label: string;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Sets `label` according to the passed arguments.
	 * @param args Expected arguments: [label of branch]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 1, line);
		this.label = args[0];
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);

		if (last !== 0n) {
			this.interpreter.jumpForward(this.label, this.line);
		}
		return this.computeCost();
	}
}

// branch conditionally if top of stack is non zero - Tealv4
// can jump forward as well
// push to stack [...stack]
export class BranchIfNotZerov4 extends BranchIfNotZero {
	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBigInt(stack.pop(), this.line);

		if (last !== 0n) {
			this.interpreter.jumpToLabel(this.label, this.line);
		}

		return this.computeCost();
	}
}

// use last value on stack as success value; end
// push to stack [...stack, last]
export class Return extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);

		const last = stack.pop();
		while (stack.length()) {
			stack.pop();
		}
		stack.push(last); // use last value as success
		this.interpreter.instructionIndex = this.interpreter.instructions.length; // end execution

		return this.computeCost();
	}
}

// push field from current transaction to stack
export class Global extends Op {
	readonly field: string;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores global field to query as string
	 * @param args Expected arguments: [field] // Ex: ["GroupSize"]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 1, line);
		this.assertGlobalDefined(args[0], interpreter.tealVersion, line);

		this.field = args[0]; // global field
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		let result;
		switch (this.field) {
			case "GroupSize": {
				result = this.interpreter.runtime.ctx.gtxs.length;
				break;
			}
			case "CurrentApplicationID": {
				result = this.interpreter.runtime.ctx.tx.apid;
				this.interpreter.runtime.assertAppDefined(
					result as number,
					this.interpreter.getApp(result as number, this.line),
					this.line
				);
				break;
			}
			case "Round": {
				result = this.interpreter.runtime.getRound();
				break;
			}
			case "LatestTimestamp": {
				result = this.interpreter.runtime.getTimestamp();
				break;
			}
			case "CreatorAddress": {
				const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
				const app = this.interpreter.getApp(appID, this.line);
				result = decodeAddress(app.creator).publicKey;
				break;
			}
			case "GroupID": {
				result = Uint8Array.from(this.interpreter.runtime.ctx.tx.grp ?? ZERO_ADDRESS);
				break;
			}
			case "CurrentApplicationAddress": {
				const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
				result = decodeAddress(getApplicationAddress(appID)).publicKey;
				break;
			}
			case "CallerApplicationID": {
				result = this.interpreter.runtime.ctx.getCallerApplicationID();
				break;
			}
			case "CallerApplicationAddress": {
				const callerAddress = this.interpreter.runtime.ctx.getCallerApplicationAddress();
				result = decodeAddress(callerAddress).publicKey;
				break;
			}

			case "OpcodeBudget": {
				const maxBudget = this.interpreter.getBudget();
				const currentTotalCost =
					this.interpreter.mode === ExecutionMode.SIGNATURE
						? this.interpreter.cost
						: this.interpreter.runtime.ctx.pooledApplCost;
				result = maxBudget - (currentTotalCost + 1); // include global OpcodeBudget
				break;
			}
			default: {
				result = GlobalFields[this.interpreter.tealVersion][this.field];
			}
		}
		if (typeof result === "number") {
			stack.push(BigInt(result));
		} else {
			stack.push(result);
		}
		return this.computeCost();
	}
}

// check if account specified by Txn.Accounts[A] opted in for the application B => {0 or 1}
// params: account index, application id (top of the stack on opcode entry).
// push to stack [...stack, 1] if opted in
// push to stack[...stack, 0] 0 otherwise
export class AppOptedIn extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const appRef = this.assertBigInt(stack.pop(), this.line);
		const accountRef: StackElem = stack.pop(); // index to tx.accounts[] OR an address directly

		const account = this.interpreter.getAccount(accountRef, this.line);
		const localState = account.appsLocalState;

		const appID = this.interpreter.getAppIDByReference(Number(appRef), false, this.line, this);
		const isOptedIn = localState.get(appID);
		if (isOptedIn) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// read from account specified by Txn.Accounts[A] from local state of the current application key B => value
// push to stack [...stack, bigint/bytes] If key exist
// push to stack [...stack, 0] otherwise
export class AppLocalGet extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const key = this.assertBytes(stack.pop(), this.line);
		const accountRef: StackElem = stack.pop();

		const account = this.interpreter.getAccount(accountRef, this.line);
		const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;

		const val = account.getLocalState(appID, key);
		if (val) {
			stack.push(val);
		} else {
			stack.push(0n); // The value is zero if the key does not exist.
		}
		return this.computeCost();
	}
}

// read from application local state at Txn.Accounts[A] => app B => key C from local state.
// push to stack [...stack, value, 1] (Note: value is 0 if key does not exist)
export class AppLocalGetEx extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const key = this.assertBytes(stack.pop(), this.line);
		const appRef = this.assertBigInt(stack.pop(), this.line);
		const accountRef: StackElem = stack.pop();

		const appID = this.interpreter.getAppIDByReference(Number(appRef), false, this.line, this);
		const account = this.interpreter.getAccount(accountRef, this.line);
		const val = account.getLocalState(appID, key);
		if (val) {
			stack.push(val);
			stack.push(1n);
		} else {
			stack.push(0n); // The value is zero if the key does not exist.
			stack.push(0n); // did_exist_flag
		}
		return this.computeCost();
	}
}

// read key A from global state of a current application => value
// push to stack[...stack, 0] if key doesn't exist
// otherwise push to stack [...stack, value]
export class AppGlobalGet extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const key = this.assertBytes(stack.pop(), this.line);

		const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
		const val = this.interpreter.getGlobalState(appID, key, this.line);
		if (val) {
			stack.push(val);
		} else {
			stack.push(0n); // The value is zero if the key does not exist.
		}
		return this.computeCost();
	}
}

// read from application Txn.ForeignApps[A] global state key B pushes to the stack
// push to stack [...stack, value, 1] (Note: value is 0 if key does not exist)
// A is specified as an account index in the ForeignApps field of the ApplicationCall transaction,
// zero index means this app
export class AppGlobalGetEx extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const key = this.assertBytes(stack.pop(), this.line);
		// appRef could be index to foreign apps array,
		// or since v4 an application id that appears in Txn.ForeignApps
		const appRef = this.assertBigInt(stack.pop(), this.line);

		const appID = this.interpreter.getAppIDByReference(Number(appRef), true, this.line, this);
		const val = this.interpreter.getGlobalState(appID, key, this.line);
		if (val) {
			stack.push(val);
			stack.push(1n);
		} else {
			stack.push(0n); // The value is zero if the key does not exist.
			stack.push(0n); // did_exist_flag
		}
		return this.computeCost();
	}
}

// write to account specified by Txn.Accounts[A] to local state of a current application key B with value C
// pops from stack [...stack, value, key]
// pushes nothing to stack, updates the app user local storage
export class AppLocalPut extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const value = stack.pop();
		const key = this.assertBytes(stack.pop(), this.line);
		const accountRef: StackElem = stack.pop();

		const account = this.interpreter.getAccount(accountRef, this.line);
		const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;

		// get updated local state for account
		const localState = account.setLocalState(appID, key, value, this.line);
		const acc = this.interpreter.runtime.assertAccountDefined(
			account.address,
			this.interpreter.runtime.ctx.state.accounts.get(account.address),
			this.line
		);
		acc.appsLocalState.set(appID, localState);
		return this.computeCost();
	}
}

// write key A and value B to global state of the current application
// push to stack [...stack]
export class AppGlobalPut extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const value = stack.pop();
		const key = this.assertBytes(stack.pop(), this.line);

		const appID = this.interpreter.runtime.ctx.tx.apid ?? 0; // if undefined use 0 as default
		this.interpreter.setGlobalState(appID, key, value, this.line);
		return this.computeCost();
	}
}

// delete from account specified by Txn.Accounts[A] local state key B of the current application
// push to stack [...stack]
export class AppLocalDel extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const key = this.assertBytes(stack.pop(), this.line);
		const accountRef: StackElem = stack.pop();

		const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
		const account = this.interpreter.getAccount(accountRef, this.line);

		const localState = account.appsLocalState.get(appID);
		if (localState) {
			localState["key-value"].delete(key.toString()); // delete from local state

			let acc = this.interpreter.runtime.ctx.state.accounts.get(account.address);
			acc = this.interpreter.runtime.assertAccountDefined(account.address, acc, this.line);
			acc.appsLocalState.set(appID, localState);
		}
		return this.computeCost();
	}
}

// delete key A from a global state of the current application
// push to stack [...stack]
export class AppGlobalDel extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const key = this.assertBytes(stack.pop(), this.line);

		const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;

		const app = this.interpreter.getApp(appID, this.line);
		if (app) {
			const globalState = app["global-state"];
			globalState.delete(key.toString());
		}
		return this.computeCost();
	}
}

// get balance for the requested account specified
// by Txn.Accounts[A] in microalgos. A is specified as an account
// index in the Accounts field of the ApplicationCall transaction,
// zero index means the sender
// push to stack [...stack, bigint]
export class Balance extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts if arguments length is zero
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter Interpreter Object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.interpreter = interpreter;
		this.line = line;

		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const accountRef: StackElem = stack.pop();
		const acc = this.interpreter.getAccount(accountRef, this.line);
		stack.push(BigInt(acc.balance()));
		return this.computeCost();
	}
}

// For Account A, Asset B (txn.accounts[A]) pushes to the
// push to stack [...stack, value(bigint/bytes), 1]
// NOTE: if account has no B holding then value = 0, did_exist = 0,
export class GetAssetHolding extends Op {
	readonly interpreter: Interpreter;
	readonly field: string;
	readonly line: number;

	/**
	 * Sets field according to the passed arguments.
	 * @param args Expected arguments: [Asset Holding field]
	 * // Note: Asset holding field will be string
	 * For ex: `AssetBalance` is correct `0` is not.
	 * @param line line number in TEAL file
	 * @param interpreter Interpreter Object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.interpreter = interpreter;
		this.line = line;
		assertLen(args.length, 1, line);
		this.field = args[0];
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const assetRef = this.assertBigInt(stack.pop(), this.line);
		const accountRef: StackElem = stack.pop();

		const account = this.interpreter.getAccount(accountRef, this.line);
		const assetID = this.interpreter.getAssetIDByReference(
			Number(assetRef),
			false,
			this.line,
			this
		);
		const assetInfo = account.assets.get(assetID);
		if (assetInfo === undefined) {
			stack.push(0n);
			stack.push(0n);
			return this.computeCost();
		}
		let value: StackElem;
		switch (this.field) {
			case "AssetBalance":
				value = BigInt(assetInfo.amount);
				break;
			case "AssetFrozen":
				value = assetInfo["is-frozen"] ? 1n : 0n;
				break;
			default:
				throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_FIELD_TYPE, { line: this.line });
		}
		stack.push(value);
		stack.push(1n);
		return this.computeCost();
	}
}

// get Asset Params Info for given account
// For Index in ForeignAssets array
// push to stack [...stack, value(bigint/bytes), did_exist]
// NOTE: if asset doesn't exist, then did_exist = 0, value = 0
export class GetAssetDef extends Op {
	readonly interpreter: Interpreter;
	readonly field: string;
	readonly line: number;

	/**
	 * Sets transaction field according to the passed arguments
	 * @param args Expected arguments: [Asset Params field]
	 * // Note: Asset Params field will be string
	 * For ex: `AssetTotal` is correct `0` is not.
	 * @param line line number in TEAL file
	 * @param interpreter Interpreter Object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.interpreter = interpreter;
		assertLen(args.length, 1, line);
		if (AssetParamMap[interpreter.tealVersion][args[0]] === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_ASSET_FIELD, {
				field: args[0],
				line: line,
				tealV: interpreter.tealVersion,
			});
		}

		this.field = args[0];
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const assetRef = this.assertBigInt(stack.pop(), this.line);
		const assetID = this.interpreter.getAssetIDByReference(
			Number(assetRef),
			true,
			this.line,
			this
		);
		const AssetDefinition = this.interpreter.getAssetDef(assetID);
		let def: string;

		if (AssetDefinition === undefined) {
			stack.push(0n);
			stack.push(0n);
		} else {
			let value: StackElem;
			const s = AssetParamMap[this.interpreter.tealVersion][
				this.field
			] as keyof modelsv2.AssetParams;

			switch (this.field) {
				case "AssetTotal":
					value = BigInt(AssetDefinition.total);
					break;
				case "AssetDecimals":
					value = BigInt(AssetDefinition.decimals);
					break;
				case "AssetDefaultFrozen":
					value = AssetDefinition.defaultFrozen ? 1n : 0n;
					break;
				default:
					def = AssetDefinition[s] as string;
					if (isValidAddress(def)) {
						value = decodeAddress(def).publicKey;
					} else {
						value = parsing.stringToBytes(def);
					}
					break;
			}

			stack.push(value);
			stack.push(1n);
		}
		return this.computeCost();
	}
}

/** Pseudo-Ops **/
// push integer to stack
// push to stack [...stack, integer value]
export class Int extends Op {
	readonly uint64: bigint;
	readonly line: number;

	/**
	 * Sets uint64 variable according to the passed arguments.
	 * @param args Expected arguments: [number]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);

		let uint64;
		const intConst =
			TxOnComplete[args[0] as keyof typeof TxOnComplete] ||
			TxnType[args[0] as keyof typeof TxnType];

		// check if string is keyof TxOnComplete or TxnType
		if (intConst !== undefined) {
			uint64 = BigInt(intConst);
		} else {
			const val = assertNumber(args[0], line);
			uint64 = BigInt(val);
		}

		this.checkOverflow(uint64, line, MAX_UINT64);
		this.uint64 = uint64;
	}

	execute(stack: TEALStack): number {
		stack.push(this.uint64);
		return this.computeCost();
	}
}

// push bytes to stack
// push to stack [...stack, converted data]
export class Byte extends Op {
	readonly str: string;
	readonly encoding: EncodingType;
	readonly line: number;

	/**
	 * Sets `str` and  `encoding` values according to the passed arguments.
	 * @param args Expected arguments: [data string]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		[this.str, this.encoding] = getEncoding(args, line);
	}

	execute(stack: TEALStack): number {
		const buffer = convertToBuffer(this.str, this.encoding);
		stack.push(new Uint8Array(buffer));
		return this.computeCost();
	}
}

// decodes algorand address to bytes and pushes to stack
// push to stack [...stack, address]
export class Addr extends Op {
	readonly addr: string;
	readonly line: number;

	/**
	 * Sets `addr` value according to the passed arguments.
	 * @param args Expected arguments: [Address]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		assertLen(args.length, 1, line);
		if (!isValidAddress(args[0])) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_ADDR, { addr: args[0], line: line });
		}
		this.addr = args[0];
		this.line = line;
	}

	execute(stack: TEALStack): number {
		const addr = decodeAddress(this.addr);
		stack.push(addr.publicKey);
		return this.computeCost();
	}
}

/* TEALv3 Ops */

// immediately fail unless value top is a non-zero number
// pops from stack: [...stack, uint64]
export class Assert extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const top = this.assertBigInt(stack.pop(), this.line);
		if (top === 0n) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR, { line: this.line });
		}
		return this.computeCost();
	}
}

// push immediate UINT to the stack as an integer
// push to stack: [...stack, uint64]
export class PushInt extends Op {
	/**
	 * NOTE: in runtime this class is similar to Int, but from tealv3 perspective this is optimized
	 * because pushint args are not added to the intcblock during assembly processes
	 */
	readonly uint64: bigint;
	readonly line: number;

	/**
	 * Sets uint64 variable according to the passed arguments.
	 * @param args Expected arguments: [number]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		assertOnlyDigits(args[0], line);

		this.checkOverflow(BigInt(args[0]), line, MAX_UINT64);
		this.uint64 = BigInt(args[0]);
	}

	execute(stack: TEALStack): number {
		stack.push(this.uint64);
		return this.computeCost();
	}
}

// push bytes to stack
// push to stack [...stack, converted data]
export class PushBytes extends Op {
	/**
	 * NOTE: in runtime this class is similar to Byte, but from tealv3 perspective this is optimized
	 * because pushbytes args are not added to the bytecblock during assembly processes
	 */
	readonly str: string;
	readonly encoding: EncodingType;
	readonly line: number;

	/**
	 * Sets `str` and  `encoding` values according to the passed arguments.
	 * @param args Expected arguments: [data string]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		[this.str, this.encoding] = getEncoding(args, line);
		if (this.encoding !== EncodingType.UTF8) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE, {
				val: args[0],
				line: line,
			});
		}
	}

	execute(stack: TEALStack): number {
		const buffer = convertToBuffer(this.str, this.encoding);
		stack.push(new Uint8Array(buffer));
		return this.computeCost();
	}
}

// swaps two last values on stack: A, B -> B, A (A,B = any)
// pops from stack: [...stack, A, B]
// pushes to stack: [...stack, B, A]
export class Swap extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const a = stack.pop();
		const b = stack.pop();
		stack.push(a);
		stack.push(b);
		return this.computeCost();
	}
}

/**
 * bit indexing begins with low-order bits in integers.
 * Setting bit 4 to 1 on the integer 0 yields 16 (int 0x0010, or 2^4).
 * Indexing begins in the first bytes of a byte-string
 * (as seen in getbyte and substring). Setting bits 0 through 11 to 1
 * in a 4 byte-array of 0s yields byte 0xfff00000
 * Pops from stack: [ ... stack, {any A}, {uint64 B}, {uint64 C} ]
 * Pushes to stack: [ ...stack, uint64 ]
 * pop a target A, index B, and bit C. Set the Bth bit of A to C, and push the result
 */
export class SetBit extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const bit = this.assertBigInt(stack.pop(), this.line);
		const index = this.assertBigInt(stack.pop(), this.line);
		const target = stack.pop();

		if (bit > 1n) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.SET_BIT_VALUE_ERROR, { line: this.line });
		}

		if (typeof target === "bigint") {
			this.assert64BitIndex(index, this.line);
			const binaryStr = target.toString(2);
			const binaryArr = [...binaryStr.padStart(64, "0")];
			const size = binaryArr.length;
			binaryArr[size - Number(index) - 1] = bit === 0n ? "0" : "1";
			stack.push(parseBinaryStrToBigInt(binaryArr));
		} else {
			const byteIndex = Math.floor(Number(index) / 8);
			this.assertBytesIndex(byteIndex, target, this.line);

			const targetBit = Number(index) % 8;
			// 8th bit in a bytes array will be highest order bit in second element
			// that's why mask is reversed
			const mask = 1 << (7 - targetBit);
			if (bit === 1n) {
				// set bit
				target[byteIndex] |= mask;
			} else {
				// clear bit
				const mask = ~(1 << (7 - targetBit));
				target[byteIndex] &= mask;
			}
			stack.push(target);
		}
		return this.computeCost();
	}
}

/**
 * pop a target A (integer or byte-array), and index B. Push the Bth bit of A.
 * Pops from stack: [ ... stack, {any A}, {uint64 B}]
 * Pushes to stack: [ ...stack, uint64]
 */
export class GetBit extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const index = this.assertBigInt(stack.pop(), this.line);
		const target = stack.pop();

		if (typeof target === "bigint") {
			this.assert64BitIndex(index, this.line);
			const binaryStr = target.toString(2);
			const size = binaryStr.length;
			stack.push(BigInt(binaryStr[size - Number(index) - 1]));
		} else {
			const byteIndex = Math.floor(Number(index) / 8);
			this.assertBytesIndex(byteIndex, target, this.line);

			const targetBit = Number(index) % 8;
			const binary = target[byteIndex].toString(2);
			const str = binary.padStart(8, "0");
			stack.push(BigInt(str[targetBit]));
		}
		return this.computeCost();
	}
}

/**
 * pop a byte-array A, integer B, and
 * small integer C (between 0..255). Set the Bth byte of A to C, and push the result
 * Pops from stack: [ ...stack, {[]byte A}, {uint64 B}, {uint64 C}]
 * Pushes to stack: [ ...stack, []byte]
 */
export class SetByte extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const smallInteger = this.assertBigInt(stack.pop(), this.line);
		const index = this.assertBigInt(stack.pop(), this.line);
		const target = this.assertBytes(stack.pop(), this.line);
		this.assertUint8(smallInteger, this.line);
		this.assertBytesIndex(Number(index), target, this.line);

		target[Number(index)] = Number(smallInteger);
		stack.push(target);
		return this.computeCost();
	}
}

/**
 * pop a byte-array A and integer B. Extract the Bth byte of A and push it as an integer
 * Pops from stack: [ ...stack, {[]byte A}, {uint64 B} ]
 * Pushes to stack: [ ...stack, uint64 ]
 */
export class GetByte extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const index = this.assertBigInt(stack.pop(), this.line);
		const target = this.assertBytes(stack.pop(), this.line);
		this.assertBytesIndex(Number(index), target, this.line);

		stack.push(BigInt(target[Number(index)]));

		return this.computeCost();
	}
}

// push the Nth value (0 indexed) from the top of the stack.
// pops from stack: [...stack]
// pushes to stack: [...stack, any (nth slot from top of stack)]
// NOTE: dig 0 is same as dup
export class Dig extends Op {
	readonly line: number;
	readonly depth: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [ depth ] // slot to duplicate
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		assertOnlyDigits(args[0], line);

		this.assertUint8(BigInt(args[0]), line);
		this.depth = Number(args[0]);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, this.depth + 1, this.line);
		const tempStack = new Stack<StackElem>(this.depth + 1); // depth = 2 means 3rd slot from top of stack
		let target;
		for (let i = 0; i <= this.depth; ++i) {
			target = stack.pop();
			tempStack.push(target);
		}
		while (tempStack.length()) {
			stack.push(tempStack.pop());
		}
		stack.push(target as StackElem);
		return this.computeCost();
	}
}

// selects one of two values based on top-of-stack: A, B, C -> (if C != 0 then B else A)
// pops from stack: [...stack, {any A}, {any B}, {uint64 C}]
// pushes to stack: [...stack, any (A or B)]
export class Select extends Op {
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const toCheck = this.assertBigInt(stack.pop(), this.line);
		const notZeroSelection = stack.pop();
		const isZeroSelection = stack.pop();

		if (toCheck !== 0n) {
			stack.push(notZeroSelection);
		} else {
			stack.push(isZeroSelection);
		}
		return this.computeCost();
	}
}

/**
 * push field F of the Ath transaction (A = top of stack) in the current group
 * pops from stack: [...stack, uint64]
 * pushes to stack: [...stack, transaction field]
 * NOTE: "gtxns field" is equivalent to "gtxn _i_ field" (where _i_ is the index
 * of transaction in group, fetched from stack).
 * gtxns exists so that i can be calculated, often based on the index of the current transaction.
 */
export class Gtxns extends Gtxn {
	/**
	 * Sets `field`, `txIdx` values according to the passed arguments.
	 * @param args Expected arguments: [transaction field]
	 * // Note: Transaction field is expected as string instead of number.
	 * For ex: `Fee` is expected and `0` is not expected.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		// NOTE: mockTxIdx is a mock value (max no of txns in group can be 16 atmost).
		// In gtxns & gtxnsa opcodes, index is fetched from top of stack.
		super([mockTxIdx, ...args], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const top = this.assertBigInt(stack.pop(), this.line);
		this.assertUint8(top, this.line);
		this.txIdx = Number(top);
		super.execute(stack);
		return this.computeCost();
	}
}

/**
 * push Ith value of the array field F from the Ath (A = top of stack) transaction in the current group
 * pops from stack: [...stack, uint64]
 * push to stack [...stack, value of field]
 */
export class Gtxnsa extends Gtxna {
	/**
	 * Sets `field`(Transaction Field), `fieldIdx`(Array Index) values according to the passed arguments.
	 * @param args Expected arguments: [transaction field(F), transaction field array index(I)]
	 *   Note: Transaction field is expected as string instead of number.
	 *   For ex: `"Fee"` is expected rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		// NOTE: txIdx will be updated in execute.
		// In gtxns & gtxnsa opcodes, index is fetched from top of stack.
		super([mockTxIdx, ...args], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const top = this.assertBigInt(stack.pop(), this.line);
		this.assertUint8(top, this.line);
		this.txIdx = Number(top);
		return super.execute(stack);
	}
}

/**
 * get minimum required balance for the requested account specified by Txn.Accounts[A] in microalgos.
 * NOTE: A = 0 represents tx.sender account. Required balance is affected by ASA and App usage. When creating
 * or opting into an app, the minimum balance grows before the app code runs, therefore the increase
 * is visible there. When deleting or closing out, the minimum balance decreases after the app executes.
 * pops from stack: [...stack, uint64(account index)]
 * push to stack [...stack, uint64(min balance in microalgos)]
 */
export class MinBalance extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts if arguments length is zero
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter Interpreter Object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.interpreter = interpreter;
		this.line = line;

		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const accountRef: StackElem = stack.pop();
		const acc = this.interpreter.getAccount(accountRef, this.line);
		stack.push(BigInt(acc.minBalance));
		return this.computeCost();
	}
}

/** TEALv4 Ops **/

// push Ith scratch space index of the Tth transaction in the current group
// push to stack [...stack, bigint/bytes]
// Pops nothing
// Args expected: [{uint8 transaction group index}(T),
// {uint8 position in scratch space to load from}(I)]
export class Gload extends Op {
	scratchIndex: number;
	txIndex: number;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores scratch space index and transaction index number according to the passed arguments.
	 * @param args Expected arguments: [index number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 2, this.line);
		assertOnlyDigits(args[0], this.line);
		assertOnlyDigits(args[1], this.line);

		this.txIndex = Number(args[0]);
		this.scratchIndex = Number(args[1]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		const scratch = this.interpreter.runtime.ctx.sharedScratchSpace.get(this.txIndex);
		if (scratch === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR, {
				index: this.txIndex,
				line: this.line,
			});
		}
		this.checkIndexBound(this.scratchIndex, scratch, this.line);
		stack.push(scratch[this.scratchIndex]);
		return this.computeCost();
	}
}

// push Ith scratch space index of the Tth transaction in the current group
// push to stack [...stack, bigint/bytes]
// Pops uint64(T)
// Args expected: [{uint8 position in scratch space to load from}(I)]
export class Gloads extends Gload {
	/**
	 * Stores scratch space index number according to argument passed.
	 * @param args Expected arguments: [index number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		// mockTxIdx is place holder value, will be updated when poping from stack in execute
		super([mockTxIdx, ...args], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		this.txIndex = Number(this.assertBigInt(stack.pop(), this.line));
		return super.execute(stack);
	}
}

// Loads a scratch space value of another transaction from the current group
// Stack: ..., A: uint64, B: uint64 → ..., any
// Availability: v6
export class Gloadss extends Gload {
	/**
	 * Stores scratch space index number according to argument passed.
	 * @param args Expected arguments: [index number]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		// Just place holder field;
		super([mockTxIdx, mockScratchIndex, ...args], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		this.scratchIndex = Number(this.assertBigInt(stack.pop(), this.line));
		this.txIndex = Number(this.assertBigInt(stack.pop(), this.line));
		return super.execute(stack);
	}
}

/**
 * Provide subroutine functionality. When callsub is called, the current location in
 * the program is saved and immediately jumps to the label passed to the opcode.
 * Pops: None
 * Pushes: None
 * The call stack is separate from the data stack. Only callsub and retsub manipulate it.
 * Pops: None
 * Pushes: Pushes current instruction index in call stack
 */
export class Callsub extends Op {
	readonly interpreter: Interpreter;
	readonly label: string;
	readonly line: number;

	/**
	 * Sets `label` according to the passed arguments.
	 * @param args Expected arguments: [label of branch]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 1, line);
		this.label = args[0];
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(_stack: TEALStack): number {
		// the current location in the program is saved
		this.interpreter.callStack.push(this.interpreter.instructionIndex);
		// immediately jumps to the label passed to the opcode.
		this.interpreter.jumpToLabel(this.label, this.line);
		return this.computeCost();
	}
}

/**
 * When the retsub opcode is called, the AVM will resume
 * execution at the previous saved point.
 * Pops: None
 * Pushes: None
 * The call stack is separate from the data stack. Only callsub and retsub manipulate it.
 * Pops: index from call stack
 * Pushes: None
 */
export class Retsub extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * @param args Expected arguments: []
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		assertLen(args.length, 0, line);
		this.interpreter = interpreter;
		this.line = line;
	}

	execute(_stack: TEALStack): number {
		// get current location from saved point
		// jump to saved instruction opcode
		if (this.interpreter.callStack.length() === 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.CALL_STACK_EMPTY, { line: this.line });
		}
		this.interpreter.instructionIndex = this.interpreter.callStack.pop();
		return this.computeCost();
	}
}

// generic op to execute byteslice arithmetic
// `b+`, `b-`, `b*`, `b/`, `b%`, `b<`, `b>`, `b<=`,
// `b>=`, `b==`, `b!=`, `b\`, `b&`, `b^`, `b~`, `bzero`
export class ByteOp extends Op {
	readonly line: number;
	op: MathOp | undefined;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	computeCost(): number {
		switch (this.op) {
			case MathOp.Add:
			case MathOp.Sub: {
				return OpGasCost[4]["b+"];
			}
			case MathOp.Mul:
			case MathOp.Div:
			case MathOp.Mod: {
				return OpGasCost[4]["b*"];
			}
			case MathOp.BitwiseOr:
			case MathOp.BitwiseAnd:
			case MathOp.BitwiseXor: {
				return OpGasCost[4]["b|"];
			}
			default: {
				return 1;
			}
		}
	}

	execute(stack: TEALStack, op: MathOp): number {
		this.op = op;
		this.assertMinStackLen(stack, 2, this.line);
		const byteB = this.assertBytes(stack.pop(), this.line, MAX_INPUT_BYTE_LEN);
		const byteA = this.assertBytes(stack.pop(), this.line, MAX_INPUT_BYTE_LEN);
		const bigIntB = bigEndianBytesToBigInt(byteB);
		const bigIntA = bigEndianBytesToBigInt(byteA);

		let r: bigint | boolean;
		switch (op) {
			case MathOp.Add: {
				r = bigIntA + bigIntB;
				break;
			}
			case MathOp.Sub: {
				r = bigIntA - bigIntB;
				this.checkUnderflow(r, this.line);
				break;
			}
			case MathOp.Mul: {
				// NOTE: 12n * 0n == 0n, but in bytesclice arithmatic, this is equivalent to
				// empty bytes (eg. byte "A" * byte "" === byte "")
				r = bigIntA * bigIntB;
				break;
			}
			case MathOp.Div: {
				if (bigIntB === 0n) {
					throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
				}
				r = bigIntA / bigIntB;
				break;
			}
			case MathOp.Mod: {
				if (bigIntB === 0n) {
					throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
				}
				r = bigIntA % bigIntB;
				break;
			}
			case MathOp.LessThan: {
				r = bigIntA < bigIntB;
				break;
			}
			case MathOp.GreaterThan: {
				r = bigIntA > bigIntB;
				break;
			}
			case MathOp.LessThanEqualTo: {
				r = bigIntA <= bigIntB;
				break;
			}
			case MathOp.GreaterThanEqualTo: {
				r = bigIntA >= bigIntB;
				break;
			}
			case MathOp.EqualTo: {
				r = bigIntA === bigIntB;
				break;
			}
			case MathOp.NotEqualTo: {
				r = bigIntA !== bigIntB;
				break;
			}
			case MathOp.BitwiseOr: {
				r = bigIntA | bigIntB;
				break;
			}
			case MathOp.BitwiseAnd: {
				r = bigIntA & bigIntB;
				break;
			}
			case MathOp.BitwiseXor: {
				r = bigIntA ^ bigIntB;
				break;
			}
			default: {
				throw new Error("Operation not supported");
			}
		}

		if (typeof r === "boolean") {
			stack.push(BigInt(r)); // 0 or 1
		} else {
			const resultAsBytes = r === 0n ? new Uint8Array([]) : bigintToBigEndianBytes(r);
			if (op === MathOp.BitwiseOr || op === MathOp.BitwiseAnd || op === MathOp.BitwiseXor) {
				// for bitwise ops, zero's are "left" padded upto length.max(byteB, byteA)
				// https://developer.algorand.org/docs/reference/teal/specification/#arithmetic-logic-and-cryptographic-operations
				const maxSize = Math.max(byteA.length, byteB.length);

				const paddedZeroArr = new Uint8Array(Math.max(0, maxSize - resultAsBytes.length)).fill(
					0
				);
				const mergedArr = new Uint8Array(maxSize);
				mergedArr.set(paddedZeroArr);
				mergedArr.set(resultAsBytes, paddedZeroArr.length);
				stack.push(this.assertBytes(mergedArr, this.line, MAX_OUTPUT_BYTE_LEN));
			} else {
				stack.push(this.assertBytes(resultAsBytes, this.line, MAX_OUTPUT_BYTE_LEN));
			}
		}
		return this.computeCost();
	}
}

// A plus B, where A and B are byte-arrays interpreted as big-endian unsigned integers
// panics on overflow (result > max_uint1024 i.e 128 byte num)
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteAdd extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.Add);
	}
}

// A minus B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Panic on underflow.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteSub extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.Sub);
	}
}

// A times B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteMul extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.Mul);
	}
}

// A divided by B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Panic if B is zero.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteDiv extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.Div);
	}
}

// A modulo B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Panic if B is zero.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteMod extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.Mod);
	}
}

// A is greater than B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteGreaterThan extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.GreaterThan);
	}
}

// A is less than B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteLessThan extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.LessThan);
	}
}

// A is greater than or equal to B, where A and B are byte-arrays interpreted
// as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteGreaterThanEqualTo extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.GreaterThanEqualTo);
	}
}

// A is less than or equal to B, where A and B are byte-arrays interpreted as
// big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteLessThanEqualTo extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.LessThanEqualTo);
	}
}

// A is equals to B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteEqualTo extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.EqualTo);
	}
}

// A is not equal to B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteNotEqualTo extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.NotEqualTo);
	}
}

// A bitwise-or B, where A and B are byte-arrays, zero-left extended to the greater of their lengths
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteBitwiseOr extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.BitwiseOr);
	}
}

// A bitwise-and B, where A and B are byte-arrays, zero-left extended to the greater of their lengths
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteBitwiseAnd extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.BitwiseAnd);
	}
}

// A bitwise-xor B, where A and B are byte-arrays, zero-left extended to the greater of their lengths
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteBitwiseXor extends ByteOp {
	execute(stack: TEALStack): number {
		return super.execute(stack, MathOp.BitwiseXor);
	}
}

// X (bytes array) with all bits inverted
// Pops: ... stack, []byte
// push to stack [...stack, byte[]]
export class ByteBitwiseInvert extends ByteOp {
	computeCost(): number {
		return OpGasCost[4]["b~"];
	}
	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const byteA = this.assertBytes(stack.pop(), this.line, MAX_INPUT_BYTE_LEN);
		stack.push(byteA.map((b) => 255 - b));
		return this.computeCost();
	}
}

// push a byte-array of length X, containing all zero bytes
// Pops: ... stack, uint64
// push to stack [...stack, byte[]]
export class ByteZero extends ByteOp {
	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const len = this.assertBigInt(stack.pop(), this.line);
		const result = new Uint8Array(Number(len)).fill(0);
		stack.push(this.assertBytes(result, this.line, 4096));

		return this.computeCost();
	}
}

// The largest integer I such that I^2 <= A. A and I are interpreted as big-endian unsigned integers
// Stack: ..., A: []byte → ..., []byte
// Cost: 40
// Availability: v6
export class Bsqrt extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	computeCost(): number {
		return OpGasCost[6]["bsqrt"];
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const value = this.assertBytes(stack.pop(), this.line, MAX_INPUT_BYTE_LEN);
		// convert to bigint
		const bigintValue = bigEndianBytesToBigInt(value);
		// compute sqrt
		const bigintResult = bigintSqrt(bigintValue);
		stack.push(bigintToBigEndianBytes(bigintResult));
		return this.computeCost();
	}
}
/**
 * Pop four uint64 values. The deepest two are interpreted
 * as a uint128 dividend (deepest value is high word),
 * the top two are interpreted as a uint128 divisor.
 * Four uint64 values are pushed to the stack.
 * The deepest two are the quotient (deeper value
 * is the high uint64). The top two are the remainder, low bits on top.
 * Pops: ... stack, {uint64 A}, {uint64 B}, {uint64 C}, {uint64 D}
 * Pushes: ... stack, uint64, uint64, uint64, uint64
 */
export class DivModw extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		// Go-algorand implementation: https://github.com/algorand/go-algorand/blob/8f743a98827372bfd8928de3e0b70390ff34f407/data/transactions/logic/eval.go#L927
		const firstLow = this.assertBigInt(stack.pop(), this.line);
		const firstHigh = this.assertBigInt(stack.pop(), this.line);

		let divisor = firstHigh << BigInt("64");
		divisor = divisor + firstLow;

		const secondLow = this.assertBigInt(stack.pop(), this.line);
		const secondHigh = this.assertBigInt(stack.pop(), this.line);

		let dividend = secondHigh << BigInt("64");
		dividend = dividend + secondLow;

		const quotient = dividend / divisor;
		let low = quotient & MAX_UINT64;
		this.checkOverflow(low, this.line, MAX_UINT64);

		let high = quotient >> BigInt("64");
		this.checkOverflow(high, this.line, MAX_UINT64);

		stack.push(high);
		stack.push(low);

		const remainder = dividend % divisor;
		low = remainder & MAX_UINT64;
		this.checkOverflow(low, this.line, MAX_UINT64);

		high = remainder >> BigInt("64");
		this.checkOverflow(high, this.line, MAX_UINT64);

		stack.push(high);
		stack.push(low);
		return this.computeCost();
	}
}

// A raised to the Bth power. Panic if A == B == 0 and on overflow
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: uint64
export class Exp extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		const b = this.assertBigInt(stack.pop(), this.line);
		const a = this.assertBigInt(stack.pop(), this.line);
		if (a === 0n && b === 0n) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.EXP_ERROR, { line: this.line });
		}
		const res = a ** b;
		this.checkOverflow(res, this.line, MAX_UINT64);
		stack.push(res);
		return this.computeCost();
	}
}

// A raised to the Bth power as a 128-bit long result as
// low (top) and high uint64 values on the stack.
// Panic if A == B == 0 or if the results exceeds 2^128-1
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: ... stack, uint64, uint64
export class Expw extends Exp {
	execute(stack: TEALStack): number {
		const b = this.assertBigInt(stack.pop(), this.line);
		const a = this.assertBigInt(stack.pop(), this.line);

		if (a === 0n && b === 0n) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.EXP_ERROR, { line: this.line });
		}
		const res = a ** b;
		this.checkOverflow(res, this.line, MAX_UINT128);

		const low = res & MAX_UINT64;
		this.checkOverflow(low, this.line, MAX_UINT64);

		const high = res >> BigInt("64");
		this.checkOverflow(high, this.line, MAX_UINT64);

		stack.push(high);
		stack.push(low);

		return this.computeCost();
	}
}

// Left shift (A times 2^B, modulo 2^64)
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: uint64
export class Shl extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		const b = this.assertBigInt(stack.pop(), this.line);
		const a = this.assertBigInt(stack.pop(), this.line);

		const res = (a << b) % 2n ** 64n;

		stack.push(res);

		return this.computeCost();
	}
}

// Right shift (A divided by 2^B)
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: uint64
export class Shr extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		const b = this.assertBigInt(stack.pop(), this.line);
		const a = this.assertBigInt(stack.pop(), this.line);

		const res = a >> b;

		stack.push(res);

		return this.computeCost();
	}
}

// The largest integer B such that B^2 <= X
// Pops: ... stack, uint64
// Pushes: uint64
export class Sqrt extends Op {
	readonly line: number;
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		// https://stackoverflow.com/questions/53683995/javascript-big-integer-square-root
		const value = this.assertBigInt(stack.pop(), this.line);
		const result = bigintSqrt(value);
		stack.push(result);
		return this.computeCost();
	}
}

// Pops: None
// Pushes: uint64
// push the ID of the asset or application created in the Tth transaction of the current group
// gaid fails unless the requested transaction created an asset or application and T < GroupIndex.
export class Gaid extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;
	txIndex: number;

	/**
	 * Asserts 1 arguments are passed.
	 * @param args Expected arguments: [txIndex]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.interpreter = interpreter;
		assertLen(args.length, 1, line);
		this.txIndex = Number(args[0]);
	}

	execute(stack: TEALStack): number {
		const knowableID = this.interpreter.runtime.ctx.knowableID.get(this.txIndex);
		if (knowableID === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.GROUP_INDEX_EXIST_ERROR, {
				index: this.txIndex,
				line: this.line,
			});
		}

		stack.push(BigInt(knowableID));
		return this.computeCost();
	}
}

// Pops: ... stack, uint64
// Pushes: uint64
// push the ID of the asset or application created in the Xth transaction of the current group
// gaid fails unless the requested transaction created an asset or application and X < GroupIndex.
export class Gaids extends Gaid {
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: []
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		// mockTxIdx is place holder argument, will be updated when poping from stack in execute
		super([mockTxIdx, ...args], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		this.txIndex = Number(this.assertBigInt(stack.pop(), this.line));
		return super.execute(stack);
	}
}

// Pops: ... stack, []byte
// Pushes: []byte
// pop a byte-array A. Op code parameters:
// * S: number in 0..255, start index
// * L: number in 0..255, length
//  extracts a range of bytes from A starting at S up to but not including S+L,
// push the substring result. If L is 0, then extract to the end of the string.
// If S or S+L is larger than the array length, the program fails
export class Extract extends Op {
	readonly line: number;
	readonly start: number;
	length: number;

	/**
	 * Asserts 2 arguments are passed.
	 * @param args Expected arguments: [txIndex]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 2, line);
		this.start = Number(args[0]);
		this.length = Number(args[1]);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const array = this.assertBytes(stack.pop(), this.line);

		// if length is 0, take bytes from start index to the end
		if (this.length === 0) {
			this.length = array.length - this.start;
		}
		stack.push(this.opExtractImpl(array, this.start, this.length));
		return this.computeCost();
	}
}

// Pops: ... stack, {[]byte A}, {uint64 S}, {uint64 L}
// Pushes: []byte
// pop a byte-array A and two integers S and L (both in 0..255).
// Extract a range of bytes from A starting at S up to but not including S+L,
// push the substring result. If S+L is larger than the array length, the program fails
export class Extract3 extends Op {
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [txIndex]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		const length = Number(this.assertBigInt(stack.pop(), this.line));
		const start = Number(this.assertBigInt(stack.pop(), this.line));
		const array = this.assertBytes(stack.pop(), this.line);
		stack.push(this.opExtractImpl(array, start, length));
		return this.computeCost();
	}
}

// Pops: ... stack, {[]byte A}, {uint64 S}
// Pushes: uint64
// Op code parameters:
// * N: number in {2,4,8}, length
// Base class to implement the extract_uint16, extract_uint32 and extract_uint64 op codes
// for N equal 2, 4, 8 respectively.
// pop a byte-array A and integer S (in 0..255). Extracts a range of bytes
// from A starting at S up to but not including B+N,
// convert bytes as big endian and push the uint(N*8) result.
// If B+N is larger than the array length, the program fails
class ExtractUintN extends Op {
	readonly line: number;
	extractBytes = 2;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [txIndex]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
		// this.extractBytes = 2;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const start = Number(this.assertBigInt(stack.pop(), this.line));
		const array = this.assertBytes(stack.pop(), this.line);

		const sliced = this.opExtractImpl(array, start, this.extractBytes); // extract n bytes
		stack.push(bigEndianBytesToBigInt(sliced));
		return this.computeCost();
	}
}

// Pops: ... stack, {[]byte A}, {uint64 B}
// Pushes: uint64
// pop a byte-array A and integer B. Extract a range of bytes
// from A starting at B up to but not including B+2,
// convert bytes as big endian and push the uint64 result.
// If B+2 is larger than the array length, the program fails
export class ExtractUint16 extends ExtractUintN {
	extractBytes = 2;
	execute(stack: TEALStack): number {
		return super.execute(stack);
	}
}

// Pops: ... stack, {[]byte A}, {uint64 B}
// Pushes: uint64
// pop a byte-array A and integer B. Extract a range of bytes
// from A starting at B up to but not including B+4, convert
// bytes as big endian and push the uint64 result.
// If B+4 is larger than the array length, the program fails
export class ExtractUint32 extends ExtractUintN {
	extractBytes = 4;
	execute(stack: TEALStack): number {
		return super.execute(stack);
	}
}

// Pops: ... stack, {[]byte A}, {uint64 B}
// Pushes: uint64
// pop a byte-array A and integer B. Extract a range of bytes from
// A starting at B up to but not including B+8, convert bytes as
// big endian and push the uint64 result. If B+8 is larger than
// the array length, the program fails
export class ExtractUint64 extends ExtractUintN {
	extractBytes = 8;

	execute(stack: TEALStack): number {
		return super.execute(stack);
	}
}

// Pops: ... stack, {[]byte A}, {[]byte B}, {[]byte C}, {[]byte D}, {[]byte E}
// Pushes: uint64
// for (data A, signature B, C and pubkey D, E) verify the signature of the
// data against the pubkey => {0 or 1}
export class EcdsaVerify extends Op {
	readonly line: number;
	readonly curveIndex: number;

	/**
	 * Asserts 1 arguments are passed.
	 * @param args Expected arguments: [txIndex]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		this.curveIndex = Number(args[0]);
	}

	computeCost(): number {
		return OpGasCost[5]["ecdsa_verify"];
	}

	/**
	 * The 32 byte Y-component of a public key is the last element on the stack,
	 * preceded by X-component of a pubkey, preceded by S and R components of a
	 * signature, preceded by the data that is fifth element on the stack.
	 * All values are big-endian encoded. The signed data must be 32 bytes long,
	 * and signatures in lower-S form are only accepted.
	 */
	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 5, this.line);
		const pubkeyE = this.assertBytes(stack.pop(), this.line);
		const pubkeyD = this.assertBytes(stack.pop(), this.line);
		const signatureC = this.assertBytes(stack.pop(), this.line);
		const signatureB = this.assertBytes(stack.pop(), this.line);
		const data = this.assertBytes(stack.pop(), this.line);

		if (this.curveIndex !== 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED, {
				line: this.line,
				index: this.curveIndex,
			});
		}

		const ec = new EC("secp256k1");
		const pub = {
			x: Buffer.from(pubkeyD).toString("hex"),
			y: Buffer.from(pubkeyE).toString("hex"),
		};
		const key = ec.keyFromPublic(pub);
		const signature = { r: signatureB, s: signatureC };
		this.pushBooleanCheck(stack, key.verify(data, signature));
		return this.computeCost();
	}
}

// Pops: ... stack, []byte
// Pushes: ... stack, []byte, []byte
// decompress pubkey A into components X, Y => [... stack, X, Y]
export class EcdsaPkDecompress extends Op {
	readonly line: number;
	readonly curveIndex: number;

	/**
	 * Asserts 1 arguments are passed.
	 * @param args Expected arguments: [txIndex]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		this.curveIndex = Number(args[0]);
	}

	computeCost(): number {
		return OpGasCost[6]["ecdsa_pk_decompress"];
	}

	/**
	 * The 33 byte public key in a compressed form to be decompressed into X and Y (top)
	 * components. All values are big-endian encoded.
	 */
	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const pubkeyCompressed = this.assertBytes(stack.pop(), this.line);

		if (this.curveIndex !== 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED, {
				line: this.line,
				index: this.curveIndex,
			});
		}

		const ec = new EC("secp256k1");
		const publicKeyUncompressed = ec.keyFromPublic(pubkeyCompressed, "hex").getPublic();
		const x = publicKeyUncompressed.getX();
		const y = publicKeyUncompressed.getY();
		stack.push(x.toBuffer());
		stack.push(y.toBuffer());
		return this.computeCost();
	}
}

// Pops: ... stack, {[]byte A}, {uint64 B}, {[]byte C}, {[]byte D}
// Pushes: ... stack, []byte, []byte
// for (data A, recovery id B, signature C, D) recover a public key => [... stack, X, Y]
export class EcdsaPkRecover extends Op {
	readonly line: number;
	readonly curveIndex: number;

	/**
	 * Asserts 1 arguments are passed.
	 * @param args Expected arguments: [txIndex]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		this.curveIndex = Number(args[0]);
	}

	computeCost(): number {
		return OpGasCost[6]["ecdsa_pk_recover"];
	}

	/**
	 * S (top) and R elements of a signature, recovery id and data (bottom) are
	 * expected on the stack and used to deriver a public key. All values are
	 * big-endian encoded. The signed data must be 32 bytes long.
	 */
	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 4, this.line);
		const signatureD = this.assertBytes(stack.pop(), this.line);
		const signatureC = this.assertBytes(stack.pop(), this.line);
		const recoverId = this.assertBigInt(stack.pop(), this.line);
		const data = this.assertBytes(stack.pop(), this.line);

		if (this.curveIndex !== 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED, {
				line: this.line,
				index: this.curveIndex,
			});
		}

		const ec = new EC("secp256k1");
		const signature = { r: signatureC, s: signatureD };
		const pubKey = ec.recoverPubKey(data, signature, Number(recoverId));
		const x = pubKey.getX();
		const y = pubKey.getY();
		stack.push(x.toBuffer());
		stack.push(y.toBuffer());
		return this.computeCost();
	}
}

// Pops: ...stack, any
// Pushes: any
// remove top of stack, and place it deeper in the stack such that
// N elements are above it. Fails if stack depth <= N.
export class Cover extends Op {
	readonly line: number;
	readonly nthInStack: number;

	/**
	 * Asserts 1 arguments are passed.
	 * @param args Expected arguments: [N]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		this.nthInStack = Number(args[0]);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, this.nthInStack + 1, this.line);

		const top = stack.pop();
		const temp = [];
		for (let count = 1; count <= this.nthInStack; ++count) {
			temp.push(stack.pop());
		}
		stack.push(top);
		for (let i = this.nthInStack - 1; i >= 0; --i) {
			stack.push(temp[i]);
		}
		return this.computeCost();
	}
}

// Pops: ... stack, any
// Pushes: any
// remove the value at depth N in the stack and shift above items down
// so the Nth deep value is on top of the stack. Fails if stack depth <= N.
export class Uncover extends Op {
	readonly line: number;
	readonly nthInStack: number;

	/**
	 * Asserts 1 arguments are passed.
	 * @param args Expected arguments: [N]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		this.nthInStack = Number(args[0]);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, this.nthInStack + 1, this.line);

		const temp = [];
		for (let count = 0; count < this.nthInStack; ++count) {
			temp.push(stack.pop());
		}

		const deepValue = stack.pop();

		for (let i = this.nthInStack - 1; i >= 0; --i) {
			stack.push(temp[i]);
		}
		stack.push(deepValue);

		return this.computeCost();
	}
}

// Pops: ... stack, uint64
// Pushes: any
// copy a value from the Xth scratch space to the stack.
// All scratch spaces are 0 at program start.
export class Loads extends Load {
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: []
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		// mockScratchIndex is place holder arguments, will be updated when poping from stack in execute
		super([mockScratchIndex, ...args], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		this.index = Number(this.assertBigInt(stack.pop(), this.line));
		return super.execute(stack);
	}
}

// Pops: ... stack, {uint64 A}, {any B}
// Pushes: None
// pop indexes A and B. store B to the Ath scratch space
export class Stores extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores index number according to the passed arguments
	 * @param args Expected arguments: []
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 0, this.line);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const value = stack.pop();
		const index = this.assertBigInt(stack.pop(), this.line);
		this.checkIndexBound(Number(index), this.interpreter.scratch, this.line);
		this.interpreter.scratch[Number(index)] = value;
		return this.computeCost();
	}
}

// Pops: None
// Pushes: None
// Begin preparation of a new inner transaction
export class ITxnBegin extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores index number according to the passed arguments
	 * @param args Expected arguments: []
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 0, this.line);
		this.interpreter = interpreter;
	}

	execute(_stack: TEALStack): number {
		if (this.interpreter.currentInnerTxnGroup.length > 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ITXN_BEGIN_WITHOUT_ITXN_SUBMIT, {
				line: this.line,
			});
		}

		if (this.interpreter.innerTxnGroups.length >= MAX_INNER_TRANSACTIONS) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.MAX_INNER_TRANSACTIONS_EXCEEDED, {
				line: this.line,
				len: this.interpreter.innerTxnGroups.length + 1,
				max: MAX_INNER_TRANSACTIONS,
			});
		}

		// cannot issue itxn when clear state application.
		if (this.interpreter.runtime.ctx.tx.apan === Number(TxOnComplete.ClearState)) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ISSUE_ITXN_WHEN_CLEAR_PROGRAM);
		}
		this.interpreter.currentInnerTxnGroup = [addInnerTransaction(this.interpreter, this.line)];
		return this.computeCost();
	}
}

// Set field F of the current inner transaction to X(last value fetched from stack)
// itxn_field fails if X is of the wrong type for F, including a byte array
// of the wrong size for use as an address when F is an address field.
// itxn_field also fails if X is an account or asset that does not appear in txn.Accounts
// or txn.ForeignAssets of the top-level transaction.
// (Setting addresses in asset creation are exempted from this requirement.)
// pops from stack [...stack, any]
// push to stack [...stack, none]
export class ITxnField extends Op {
	readonly field: string;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Set transaction field according to the passed arguments
	 * @param args Expected arguments: [transaction field]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;

		this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);
		assertLen(args.length, 1, line);
		this.field = args[0]; // field
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const valToSet: StackElem = stack.pop();

		if (this.interpreter.currentInnerTxnGroup.length === 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ITXN_FIELD_WITHOUT_ITXN_BEGIN, {
				line: this.line,
			});
		}

		const lastInnerTxID = this.interpreter.currentInnerTxnGroup.length - 1;
		const lastInnerTx = setInnerTxField(
			this.interpreter.currentInnerTxnGroup[lastInnerTxID],
			this.field,
			valToSet,
			this,
			this.interpreter,
			this.line
		);

		this.interpreter.currentInnerTxnGroup[lastInnerTxID] = lastInnerTx;

		return this.computeCost();
	}
}

// Pops: None
// Pushes: None
// Execute the current inner transaction.
export class ITxnSubmit extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores index number according to the passed arguments
	 * @param args Expected arguments: []
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 0, this.line);
		this.interpreter = interpreter;
	}

	// eslint-disable-next-line sonarjs/cognitive-complexity
	execute(_stack: TEALStack): number {
		if (this.interpreter.currentInnerTxnGroup.length === 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ITXN_SUBMIT_WITHOUT_ITXN_BEGIN, {
				line: this.line,
			});
		}

		if (this.interpreter.runtime.parentCtx === undefined) {
			this.interpreter.runtime.parentCtx = cloneDeep(this.interpreter.runtime.ctx);
		}

		// calculate remaining fee after executing an inner tx
		const credit = calculateInnerTxCredit(this.interpreter);

		// remaining fee is negative => can't paid for transaction => fail
		if (credit.remainingFee < 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH, {
				required: credit.requiredFee,
				collected: credit.collectedFee,
			});
		}

		// initial contract account.
		const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
		const contractAddress = getApplicationAddress(appID);
		const contractAccount = this.interpreter.runtime.getAccount(contractAddress).account;

		// Supports only calling app(NoOpt) for app transaction type.
		for (const tx of this.interpreter.currentInnerTxnGroup) {
			if (tx.type === TransactionTypeEnum.APPLICATION_CALL && !isEncTxApplicationCall(tx)) {
				console.log(
					chalk.yellowBright("Current Runtime version only supports application call!!!")
				);
				return this.computeCost();
			}
		}

		// increase Budget when submit application call transaction
		const applCallTxNumber = this.interpreter.currentInnerTxnGroup.filter(
			(txn) => txn.type === TransactionTypeEnum.APPLICATION_CALL
		).length;
		this.interpreter.runtime.ctx.budget += MAX_APP_PROGRAM_COST * applCallTxNumber;

		// get execution txn params (parsed from encoded sdk txn obj)
		// singer will be contractAccount
		const execParams = this.interpreter.currentInnerTxnGroup.map((encTx) =>
			encTxToExecParams(
				encTx,
				{
					sign: types.SignType.SecretKey,
					fromAccount: contractAccount,
				},
				this.interpreter.runtime.ctx,
				this.line
			)
		);
		try {
			const baseCurrTx = cloneDeep(this.interpreter.runtime.ctx.tx);
			const baseCurrTxGrp = cloneDeep(this.interpreter.runtime.ctx.gtxs);

			this.interpreter.runtime.ctx.remainingFee = credit.remainingFee;
			// set up context for inner transaction
			this.interpreter.runtime.ctx.tx = this.interpreter.currentInnerTxnGroup[0];
			this.interpreter.runtime.ctx.gtxs = this.interpreter.currentInnerTxnGroup;
			this.interpreter.runtime.ctx.isInnerTx = true;

			// TODO check minimum fee
			//this.interpreter.runtime.ctx.deductFee()

			const signedTransactions: algosdk.SignedTransaction[] = execParams.map((txnParam) =>
				types.isExecParams(txnParam)
					? {
							sig: Buffer.alloc(5),
							sgnr: Buffer.from(algosdk.decodeAddress(contractAddress).publicKey),
							txn: webTx.mkTransaction(txnParam, mockSuggestedParams(txnParam.payFlags, 1)),
					  }
					: txnParam
			);
			this.interpreter.runtime.ctx.processTransactions(signedTransactions);

			// update current txns to base (top-level) after innerTx execution
			this.interpreter.runtime.ctx.tx = baseCurrTx;
			this.interpreter.runtime.ctx.gtxs = baseCurrTxGrp;

			// save executed tx
			this.interpreter.innerTxnGroups.push(this.interpreter.currentInnerTxnGroup);

			return this.computeCost();
		} catch (err: any) {
			// throw new error
			throw new RuntimeError(err.errorDescriptor, err.args);
		} finally {
			this.interpreter.runtime.parentCtx = undefined;
			this.interpreter.runtime.ctx.isInnerTx = false;
			this.interpreter.currentInnerTxnGroup = [];
		}
	}
}

// push field F of the last inner transaction to stack
// push to stack [...stack, transaction field]
export class ITxn extends Op {
	readonly field: string;
	readonly idx: number;
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Set transaction field according to the passed arguments
	 * @param args Expected arguments: [transaction field]
	 * // Note: Transaction field is expected as string instead of number.
	 * For ex: `Fee` is expected and `0` is not expected.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.idx = -1;
		this.assertITxFieldDefined(args[0], interpreter.tealVersion, line);
		if (
			TxArrFields[interpreter.tealVersion].has(args[0]) ||
			ITxArrFields[interpreter.tealVersion].has(args[0])
		) {
			// eg. itxn Accounts 1
			assertLen(args.length, 2, line);
			assertOnlyDigits(args[1], line);
			this.idx = Number(args[1]);
		} else {
			assertLen(args.length, 1, line);
		}
		this.field = args[0]; // field
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.assertInnerTransactionExists(this.interpreter);
		stack.push(executeITxn(this));
		return this.computeCost();
	}
}

export class ITxna extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;
	readonly field: string;
	idx: number;

	/**
	 * Sets `field` and `idx` values according to the passed arguments.
	 * @param args Expected arguments: [transaction field, transaction field array index]
	 * // Note: Transaction field is expected as string instead of number.
	 * For ex: `Fee` is expected and `0` is not expected.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 2, line);
		assertOnlyDigits(args[1], line);
		this.assertITxArrFieldDefined(args[0], interpreter.tealVersion, line);

		this.field = args[0]; // field
		this.idx = Number(args[1]);
		this.interpreter = interpreter;
	}

	execute(stack: TEALStack): number {
		this.assertInnerTransactionExists(this.interpreter);
		stack.push(executeITxn(this));
		return this.computeCost();
	}
}

// Stack: ..., A: uint64 → ..., any
// Ath value of the array field F of the last inner transaction
export class ITxnas extends ITxna {
	/**
	 * Sets `field` values according to the passed arguments.
	 * @param args Expected arguments: [transaction field, transaction field array index]
	 * // Note: Transaction field is expected as string instead of number.
	 * For ex: `Fee` is expected and `0` is not expected.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super([...args, mockTxIdx], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		// TODO: should change idx type to bigint ???
		// load idx from stack
		this.idx = Number(this.assertBigInt(stack.pop(), this.line));
		return super.execute(stack);
	}
}

/**
 * txnas F:
 * push Xth value of the array field F of the current transaction
 * pops from stack: [...stack, uint64]
 * pushes to stack: [...stack, transaction field]
 */
export class Txnas extends Txna {
	/**
	 * Sets `field`, `txIdx` values according to the passed arguments.
	 * @param args Expected arguments: [transaction field]
	 *   Note: Transaction field is expected as string instead of number.
	 *   For ex: `"Fee"` rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		assertLen(args.length, 1, line);
		// NOTE: txField will be updated in execute.
		super([...args, mockTxFieldIdx], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const top = this.assertBigInt(stack.pop(), this.line);
		this.fieldIdx = Number(top);
		return super.execute(stack);
	}
}

/**
 * gtxnas T F:
 * push Xth value of the array field F from the Tth transaction in the current group
 * pops from stack: [...stack, uint64]
 * push to stack [...stack, value of field]
 */
export class Gtxnas extends Gtxna {
	/**
	 * Sets `field`(Transaction Field) and
	 * `txIdx`(Transaction Group Index) values according to the passed arguments.
	 * @param args Expected arguments: [transaction group index, transaction field]
	 *   Note: Transaction field is expected as string instead of number.
	 *   For ex: `"Fee"` rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		assertLen(args.length, 2, line);
		// NOTE: txFieldIdx will be updated in execute.
		super([...args, mockTxFieldIdx], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const top = this.assertBigInt(stack.pop(), this.line);
		this.fieldIdx = Number(top);
		return super.execute(stack);
	}
}

/**
 * gtxnsas F:
 * pop an index A and an index B. push Bth value of the array
 * field F from the Ath transaction in the current group
 * pops from stack: [...stack, {uint64 A}, {uint64 B}]
 * push to stack [...stack, value of field]
 */
export class Gtxnsas extends Gtxna {
	/**
	 * Sets `field`(Transaction Field)
	 * @param args Expected arguments: [transaction field]
	 *   Note: Transaction field is expected as string instead of number.
	 *   For ex: `"Fee"` rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		assertLen(args.length, 1, line);
		// NOTE: txIdx and TxFieldIdx will be updated in execute.
		super([mockTxIdx, args[0], mockTxFieldIdx], line, interpreter);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		const arrFieldIdx = this.assertBigInt(stack.pop(), this.line);
		const txIdxInGrp = this.assertBigInt(stack.pop(), this.line);
		this.fieldIdx = Number(arrFieldIdx);
		this.txIdx = Number(txIdxInGrp);
		return super.execute(stack);
	}
}

// pushes Arg[N] from LogicSig argument array to stack
// Pops: ... stack, uint64
// push to stack [...stack, bytes]
export class Args extends Arg {
	/**
	 * Gets the argument value from interpreter.args array.
	 * store the value in _arg variable
	 * @param args Expected arguments: none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		// just place holder value
		super([...args, mockTxIdx], line, interpreter);
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const top = this.assertBigInt(stack.pop(), this.line);
		this.index = Number(top);
		return super.execute(stack);
	}
}

// Write bytes to log state of the current application
// pops to stack [...stack, bytes]
// Pushes: None
export class Log extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.interpreter = interpreter;
		assertLen(args.length, 0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const logByte = this.assertBytes(stack.pop(), this.line);
		const txID = this.interpreter.runtime.ctx.tx.txID;
		const txReceipt = this.interpreter.runtime.ctx.state.txReceipts.get(txID);

		// update last log
		this.interpreter.runtime.ctx.lastLog = logByte;
		// for Log opcode we assume receipt always exists
		// TODO: recheck when log opcode failed
		if (txReceipt) {
			if (txReceipt.logs === undefined) {
				txReceipt.logs = [];
			}

			// max no. of logs exceeded
			if (txReceipt.logs.length === ALGORAND_MAX_LOGS_COUNT) {
				throw new RuntimeError(RUNTIME_ERRORS.TEAL.LOGS_COUNT_EXCEEDED_THRESHOLD, {
					maxLogs: ALGORAND_MAX_LOGS_COUNT,
					line: this.line,
				});
			}

			// max "length" of logs exceeded
			const length = txReceipt.logs.join("").length + logByte.length;
			if (length > ALGORAND_MAX_LOGS_LENGTH) {
				throw new RuntimeError(RUNTIME_ERRORS.TEAL.LOGS_LENGTH_EXCEEDED_THRESHOLD, {
					maxLength: ALGORAND_MAX_LOGS_LENGTH,
					origLength: length,
					line: this.line,
				});
			}

			txReceipt.logs.push(logByte);
		}
		return this.computeCost();
	}
}

// bitlen interprets arrays as big-endian integers, unlike setbit/getbit
// stack = [..., any]
// push to stack = [..., bitlen]
export class BitLen extends Op {
	readonly line: number;

	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 0, line);
	}

	execute(stack: Stack<StackElem>): number {
		this.assertMinStackLen(stack, 1, this.line);
		const value = stack.pop();

		let bitlen = 0;

		if (typeof value === "bigint") {
			bitlen = value === 0n ? 0 : value.toString(2).length;
		} else {
			// value is Uint8 => one element have 8 bits.
			// => bitlen = 8 * value.length - 1 + bitlen(first element)
			if (value.length > 0) {
				bitlen = (value.length - 1) * 8;
				bitlen += value[0].toString(2).length;
			}
		}
		stack.push(BigInt(bitlen));
		return this.computeCost();
	}
}

// get App Params Information
// push to stack [...stack, value(bigint/bytes), did_exist]
// NOTE: if app doesn't exist, then did_exist = 0, value = 0
export class AppParamsGet extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;
	readonly field: string;
	/**
	 * Asserts 1 arguments are passed.
	 * @param args Expected arguments: [] // none
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.interpreter = interpreter;
		assertLen(args.length, 1, line);

		if (!AppParamDefined[interpreter.tealVersion].has(args[0])) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_APP_FIELD, {
				field: args[0],
				line: line,
				tealV: interpreter.tealVersion,
			});
		}

		this.field = args[0];
	}

	execute(stack: Stack<StackElem>): number {
		this.assertMinStackLen(stack, 1, this.line);

		const appID = this.assertBigInt(stack.pop(), this.line);

		if (this.interpreter.runtime.ctx.state.globalApps.has(Number(appID))) {
			let value: StackElem = 0n;
			const appDef = this.interpreter.getApp(Number(appID), this.line);
			switch (this.field) {
				case "AppApprovalProgram":
					value = parsing.stringToBytes(appDef["approval-program"]);
					break;
				case "AppClearStateProgram":
					value = parsing.stringToBytes(appDef["clear-state-program"]);
					break;
				case "AppGlobalNumUint":
					value = BigInt(appDef["global-state-schema"].numUint);
					break;
				case "AppGlobalNumByteSlice":
					value = BigInt(appDef["global-state-schema"].numByteSlice);
					break;
				case "AppLocalNumUint":
					value = BigInt(appDef["local-state-schema"].numUint);
					break;
				case "AppLocalNumByteSlice":
					value = BigInt(appDef["local-state-schema"].numByteSlice);
					break;
				case "AppExtraProgramPages":
					// only return default number extra program pages in runtime
					// should fix it in future.
					value = 1n;
					break;
				case "AppCreator":
					value = decodeAddress(appDef.creator).publicKey;
					break;
				case "AppAddress":
					value = decodeAddress(getApplicationAddress(appID)).publicKey;
			}

			stack.push(value);
			stack.push(1n);
		} else {
			stack.push(0n);
			stack.push(0n);
		}
		return this.computeCost();
	}
}
export class AcctParamsGet extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;
	readonly field: string;
	/**
	 * @param args Expected arguments: [account_param]
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		this.interpreter = interpreter;
		assertLen(args.length, 1, line);

		if (
			!AcctParamQueryFields[args[0]] ||
			AcctParamQueryFields[args[0]].version > interpreter.tealVersion
		) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_ACCT_FIELD, {
				field: args[0],
				line: line,
				tealV: interpreter.tealVersion,
			});
		}

		this.field = args[0];
	}

	execute(stack: Stack<StackElem>): number {
		this.assertMinStackLen(stack, 1, this.line);

		const acctAddress = this.assertAlgorandAddress(stack.pop(), this.line);

		// get account from current context
		// not `create` flag = true
		const accountInfo = this.interpreter.getAccount(acctAddress, this.line, true);

		let value: StackElem = 0n;
		switch (this.field) {
			case "AcctBalance": {
				value = BigInt(accountInfo.balance());
				break;
			}
			case "AcctMinBalance": {
				value = BigInt(accountInfo.minBalance);
				break;
			}
			case "AcctAuthAddr": {
				if (accountInfo.getSpendAddress() === accountInfo.address) {
					value = ZERO_ADDRESS;
				} else {
					value = Buffer.from(decodeAddress(accountInfo.getSpendAddress()).publicKey);
				}
				break;
			}
		}
		stack.push(value);

		if (accountInfo.balance() > 0) {
			stack.push(1n);
		} else {
			stack.push(0n);
		}
		return this.computeCost();
	}
}

// Pops: None
// Pushes: None
// Begin preparation of a new inner transaction in the same transaction group
export class ITxnNext extends Op {
	readonly interpreter: Interpreter;
	readonly line: number;

	/**
	 * Stores index number according to the passed arguments
	 * @param args Expected arguments: []
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super();
		this.line = line;
		assertLen(args.length, 0, this.line);
		this.interpreter = interpreter;
	}

	execute(_stack: TEALStack): number {
		if (this.interpreter.currentInnerTxnGroup.length === 0) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.ITXN_NEXT_WITHOUT_ITXN_BEGIN, {
				line: this.line,
			});
		}

		if (this.interpreter.innerTxnGroups.length >= MAX_INNER_TRANSACTIONS) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.MAX_INNER_TRANSACTIONS_EXCEEDED, {
				line: this.line,
				len: this.interpreter.innerTxnGroups.length + 1,
				max: MAX_INNER_TRANSACTIONS,
			});
		}

		this.interpreter.currentInnerTxnGroup.push(
			addInnerTransaction(this.interpreter, this.line)
		);
		return this.computeCost();
	}
}

// Stack: ... → ..., any
// field F of the Tth transaction in the last inner group submitted
export class Gitxn extends Gtxn {
	/**
	 * Sets `txIdx `field`, ` values according to the passed arguments.
	 * @param args Expected arguments: [transaction group index, transaction field]
	 * // Note: Transaction field is expected as string instead of number.
	 * For ex: `Fee` is expected and `0` is not expected.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super(args, line, interpreter);
	}

	execute(stack: TEALStack): number {
		// change context to last inner txn submitted
		const lastInnerTxnGroupIndex = this.interpreter.innerTxnGroups.length - 1;
		const lastInnerTxnGroup = this.interpreter.innerTxnGroups[lastInnerTxnGroupIndex];
		this.groupTxn = lastInnerTxnGroup;
		return super.execute(stack);
	}
}

//Stack: ... → ..., any
//Ith value of the array field F from the Tth transaction in the last inner group submitted
export class Gitxna extends Gtxna {
	/**
	 * Sets `field`(Transaction Field), `fieldIdx`(Array Index) and
	 * `txIdx`(Transaction Group Index) values according to the passed arguments.
	 * @param args Expected arguments:
	 *   [transaction group index, transaction field, transaction field array index]
	 *   Note: Transaction field is expected as string instead of a number.
	 *   For ex: `"Fee"` rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super(args, line, interpreter);
	}

	execute(stack: TEALStack): number {
		// change context to last inner txn submitted
		const lastInnerTxnGroupIndex = this.interpreter.innerTxnGroups.length - 1;
		const lastInnerTxnGroup = this.interpreter.innerTxnGroups[lastInnerTxnGroupIndex];
		this.groupTxn = lastInnerTxnGroup;
		return super.execute(stack);
	}
}

export class Gitxnas extends Gtxnas {
	/**
	 * Sets `field`(Transaction Field), `fieldIdx`(Array Index) and
	 * `txIdx`(Transaction Group Index) values according to the passed arguments.
	 * @param args Expected arguments:
	 *   [transaction group index, transaction field, transaction field array index]
	 *   Note: Transaction field is expected as string instead of a number.
	 *   For ex: `"Fee"` rather than `0`.
	 * @param line line number in TEAL file
	 * @param interpreter interpreter object
	 */
	constructor(args: string[], line: number, interpreter: Interpreter) {
		super(args, line, interpreter);
	}

	execute(stack: TEALStack): number {
		// change context to last inner txn submitted
		const lastInnerTxnGroupIndex = this.interpreter.innerTxnGroups.length - 1;
		const lastInnerTxnGroup = this.interpreter.innerTxnGroups[lastInnerTxnGroupIndex];
		this.groupTxn = lastInnerTxnGroup;
		return super.execute(stack);
	}
}

/**
 * Takes the last value from stack and if base64encoded, decodes it acording to the
 * encoding e and pushes it back to the stack, otherwise throws an error
 */
export class Base64Decode extends Op {
	readonly line: number;
	readonly encoding: BufferEncoding;
	length = 1;

	/**
	 * Asserts 1 argument is passed.
	 * @param args Expected arguments: [e], where e = {URLEncoding, StdEncoding}.
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		super();
		this.line = line;
		assertLen(args.length, 1, line);
		const argument = args[0];
		switch (argument) {
			case "URLEncoding": {
				this.encoding = "base64url";
				break;
			}
			case "StdEncoding": {
				this.encoding = "base64";
				break;
			}
			default: {
				throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_ENCODING, {
					encoding: argument,
					line: this.line,
				});
			}
		}
	}

	computeCost(): number {
		return 1 + Math.ceil(this.length / 16); // cost = 1 + ceil(bytes / 16)
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 1, this.line);
		const last = this.assertBytes(stack.pop(), this.line);
		this.length = last.length;
		const enc = new TextDecoder("utf-8");
		const decoded = enc.decode(last);
		switch (this.encoding) {
			case "base64url":
				assertBase64Url(convertToString(last), this.line);
				break;
			case "base64":
				assertBase64(convertToString(last), this.line);
				break;
		}
		stack.push(new Uint8Array(Buffer.from(decoded.toString(), this.encoding)));
		return this.computeCost();
	}
}

export class Replace extends Op {
	readonly line: number;
	start: number;
	original: Uint8Array;
	replace: Uint8Array;

	constructor(start: number, line: number) {
		super();
		this.line = line;
		this.start = start;
		this.original = new Uint8Array();
		this.replace = new Uint8Array();
	}

	execute(stack: TEALStack): number {
		if (this.start + this.replace.length > this.original.length) {
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.BYTES_REPLACE_ERROR, {
				lenReplace: this.replace.length,
				index: this.start,
				lenOriginal: this.original.length,
				line: this.line,
			});
		}
		const result = new Uint8Array(this.original.length);
		for (let i = 0, j = 0; i < this.original.length; ++i) {
			if (i >= this.start && i < this.start + this.replace.length) {
				result[i] = this.replace[j++];
			} else {
				result[i] = this.original[i];
			}
		}
		stack.push(result);
		return this.computeCost();
	}
}

/**
 * Opcode: replace2 s
 * Stack: ..., A: []byte, B: []byte → ..., []byte
 * Copy of A with the bytes starting at S replaced by the bytes of B. Fails if S+len(B) exceeds len(A)
 */
export class Replace2 extends Replace {
	/**
	 * Asserts 0 arguments are passed.
	 * @param args Expected arguments: [start_index]
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		assertLen(args.length, 1, line);
		super(Number(args[0]), line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 2, this.line);
		this.replace = this.assertBytes(stack.pop(), this.line);
		this.original = this.assertBytes(stack.pop(), this.line);
		return super.execute(stack);
	}
}

/**
 * Opcode: replace3
 * Stack: ..., A: []byte, B: uint64, C: []byte → ..., []byte
 * Copy of A with the bytes starting at B replaced by the bytes of C. Fails if B+len(C) exceeds len(A)
 */
export class Replace3 extends Replace {
	/**
	 * Asserts 0 arguments are passed.
	 * @param line line number in TEAL file
	 */
	constructor(args: string[], line: number) {
		assertLen(args.length, 0, line);
		super(0, line);
	}

	execute(stack: TEALStack): number {
		this.assertMinStackLen(stack, 3, this.line);
		this.replace = this.assertBytes(stack.pop(), this.line);
		this.start = Number(this.assertBigInt(stack.pop(), this.line));
		this.original = this.assertBytes(stack.pop(), this.line);
		return super.execute(stack);
	}
}
