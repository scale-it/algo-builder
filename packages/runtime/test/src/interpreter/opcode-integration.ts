import { ErrorDescriptor } from "@algo-builder/web";
import { decodeAddress } from "algosdk";
import { assert } from "chai";

import { Runtime } from "../../../src";
import RUNTIME_ERRORS from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import { ExecutionMode } from "../../../src/types";
import { expectRuntimeError } from "../../helpers/runtime-errors";
import { elonAddr, TXN_OBJ } from "../../mocks/txn";

describe("Integration Teal", function () {
	const ERROR = 0;
	const SUCCESS = 1;

	describe("Tealv8", function () {
		const tealVersion = 8;
		const elonPk = decodeAddress(elonAddr).publicKey;
		//setup the enviroment
		let interpreter: Interpreter;

		this.beforeEach(function () {
			interpreter = new Interpreter();
			interpreter.runtime = new Runtime([]);
			interpreter.tealVersion = tealVersion;
			interpreter.runtime.ctx.tx = { ...TXN_OBJ, snd: Buffer.from(elonPk) };
			// set new tx receipt
			interpreter.runtime.ctx.state.txReceipts.set(TXN_OBJ.txID, {
				txn: TXN_OBJ,
				txID: TXN_OBJ.txID,
			});
		});

		const executeTEAL = (tealCode: string): void => {
			interpreter.execute(tealCode, ExecutionMode.APPLICATION, interpreter.runtime, 0);
		};

		describe("Switch opcode", function () {
			const testTeal = (args: {
				tealCode: string;
				expected: number;
				error?: ErrorDescriptor;
			}) =>
				function () {
					if (args.expected === 0) {
						if (args.error) {
							expectRuntimeError(() => executeTEAL(args.tealCode), args.error);
						} else {
							assert.throws(() => executeTEAL(args.tealCode));
						}
					} else {
						assert.doesNotThrow(() => executeTEAL(args.tealCode));
					}
				};

			it(
				"Should move to indexed label",
				testTeal({
					tealCode: ` int 1
                            switch label1 label2
                            err
                            label2:
                            int 1`,
					expected: SUCCESS,
				})
			);

			it(
				"Should move to indexed label (more labels)",
				testTeal({
					tealCode: ` int 4
                            switch label1 label2 label3 label4 label5
                            err
                            label1:
                            err
                            label4:
                            err
                            label5:
                            int 1`,
					expected: SUCCESS,
				})
			);

			it(
				"Should continue at the following instruction (the index exceeds labels length)",
				testTeal({
					tealCode: ` int 5
                            switch label1 label2
                            err
                            label2:
                            int 1`,
					expected: ERROR,
					error: RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR,
				})
			);

			it(
				"Should fail when target does not correspond to existing label",
				testTeal({
					tealCode: ` int 0
                            switch label1 label2
                            err
                            label2:
                            int 1`,
					expected: ERROR,
					error: RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND,
				})
			);

			it(
				"Should skip if no labels are provided",
				testTeal({
					tealCode: ` int 0
                            switch
                            int 0
                            bz label4
                            label2:
                            int 0
                            label3:
                            err
                            label4:
                            int 1`,
					expected: SUCCESS,
				})
			);

			it(
				"Should fail when index is not number",
				testTeal({
					tealCode: ` byte "fail"
                            switch label1 label2
                            label2:
                            int 1`,
					expected: ERROR,
					error: RUNTIME_ERRORS.TEAL.INVALID_TYPE,
				})
			);

			it(
				"Should allow duplicate labels",
				testTeal({
					tealCode: ` pushint 1
                            switch label1 label1
                            err
                            label1:
                            int 1`,
					expected: SUCCESS,
				})
			);
		});
	});
});
