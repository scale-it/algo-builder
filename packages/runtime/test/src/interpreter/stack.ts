import { parsing } from "@algo-builder/web";
import { assert } from "chai";

import { Stack } from "../../../src/lib/stack";
import { StackElem } from "../../../src/types";

describe("Stack", function () {
	let stack: Stack<StackElem>;

	this.beforeEach(() => {
		stack = new Stack<StackElem>();
	});

	it("assert empty stack", function () {
		assert.equal(0, stack.length());
	});

	it("should throw error while popping empty stack", function () {
		const errMsg = "pop from empty stack";
		assert.throws(() => stack.pop(), errMsg);
	});

	it("should return correct length", function () {
		stack.push(1n);
		stack.push(2n);
		assert.equal(2, stack.length());
	});

	it("should push bigint and bytes", function () {
		stack.push(10n);
		stack.push(parsing.stringToBytes("txn"));

		const str = stack.pop();
		const num = stack.pop();
		assert.deepEqual(str, parsing.stringToBytes("txn"));
		assert.equal(num, 10n);
	});

	it("should return copy of stack upto depth", function () {
		stack.push(1n);
		stack.push(2n);
		stack.push(3n);
		stack.push(parsing.stringToBytes("pulp"));
		stack.push(parsing.stringToBytes("fiction"));

		let newStack = stack.debug(2);
		assert.equal(newStack.length, 2);
		assert.deepEqual(newStack[0], parsing.stringToBytes("fiction")); // top
		assert.deepEqual(newStack[1], parsing.stringToBytes("pulp")); // 2nd elem from top

		newStack = stack.debug(200); // should return an array of all stack elements
		assert.equal(newStack.length, stack.length());
	});
});
