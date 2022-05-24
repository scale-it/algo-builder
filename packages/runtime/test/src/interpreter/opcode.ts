import { parsing } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { Len } from "../../../src/interpreter/opcode-list";
import { MAX_UINT64, MIN_UINT64 } from "../../../src/lib/constants";
import { Stack } from "../../../src/lib/stack";
import type { StackElem } from "../../../src/types";
import { expectRuntimeError } from "../../helpers/runtime-errors";

describe("Teal Opcodes basic assertions", function () {
	//Could be any other opcode. Its only for testing the base abstract class functionalities
	const op = new Len([], 1);

	it("check uint64 overflow", function () {
		const max = MAX_UINT64 + BigInt("5");
		const lineNumber = 1;

		expectRuntimeError(
			() => op.checkOverflow(max, lineNumber, MAX_UINT64),
			RUNTIME_ERRORS.TEAL.UINT64_OVERFLOW
		);
	});

	it("check uint64 underflow", function () {
		const min = MIN_UINT64 - 1n;
		const lineNumber = 1;

		expectRuntimeError(
			() => op.checkUnderflow(min, lineNumber),
			RUNTIME_ERRORS.TEAL.UINT64_UNDERFLOW
		);
	});

	it("check minimum stack length", function () {
		const stack = new Stack<StackElem>();
		let stackLen = 0;
		let lineNumber = 1;
		op.assertMinStackLen(stack, stackLen, lineNumber);

		stack.push(parsing.stringToBytes("arg_0"));
		stackLen = 2;
		lineNumber = 1;
		expectRuntimeError(
			() => op.assertMinStackLen(stack, stackLen, lineNumber),
			RUNTIME_ERRORS.TEAL.ASSERT_STACK_LENGTH
		);
	});

	it("Should return correct cost", function () {
		const stack = new Stack<StackElem>();
		stack.push(parsing.stringToBytes("arg_0"));
		assert.equal(1, op.execute(stack));
	});
});
