import { bobAcc } from "@algo-builder/algob/test/mocks/account";
import { decodeAddress, getApplicationAddress } from "algosdk";
import { assert, expect } from "chai";

import { AccountStore, getProgram, Interpreter, Runtime } from "../../../src";
import RUNTIME_ERRORS from "../../../src/errors/errors-list";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../../src/lib/constants";
import { AccountAddress, AccountStoreI, ExecutionMode, StackElem, TxOnComplete } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";
import { elonMuskAccount, johnAccount } from "../../mocks/account";
import { accInfo } from "../../mocks/stateful";
import { elonAddr, TXN_OBJ } from "../../mocks/txn";

export function setDummyAccInfo(acc: AccountStoreI): void {
	acc.appsLocalState = accInfo[0].appsLocalState;
	acc.appsTotalSchema = accInfo[0].appsTotalSchema;
	acc.createdApps = accInfo[0].createdApps;
}

describe("Interpreter", function () {
	let interpreter: Interpreter;
	let elonAcc: AccountStoreI;
	let johnAcc: AccountStoreI;
	let bobAccount: AccountStoreI;
	let appAccAddr: AccountAddress;
	let applicationAccount: AccountStoreI;
	let foreignAppAccAddr: AccountAddress;
	let foreignApplicationAccount: AccountStoreI;

	const elonPk = decodeAddress(elonAddr).publicKey;

	const resetInterpreterState = (): void => {
		while (interpreter.stack.length() !== 0) {
			interpreter.stack.pop();
		}
		interpreter.currentInnerTxnGroup = [];
		interpreter.runtime.ctx.pooledApplCost = 0;
		interpreter.instructions = [];
		interpreter.innerTxnGroups = [];
		interpreter.instructionIndex = 0;
		interpreter.runtime.ctx.tx = { ...TXN_OBJ, snd: Buffer.from(elonPk) };
		interpreter.runtime.ctx.gtxs = [interpreter.runtime.ctx.tx];
		interpreter.runtime.ctx.isInnerTx = false;
		// set new tx receipt
		interpreter.runtime.ctx.state.txReceipts.set(TXN_OBJ.txID, {
			txn: TXN_OBJ,
			txID: TXN_OBJ.txID,
		});
	};

	const setUpInterpreter = (
		tealVersion: number,
		appBalance: number = ALGORAND_ACCOUNT_MIN_BALANCE
	): void => {
		// setup 1st account (to be used as sender)
		elonAcc = new AccountStore(0, elonMuskAccount); // setup test account
		setDummyAccInfo(elonAcc);

		// setup 2nd account
		johnAcc = new AccountStore(0, johnAccount);

		// setup 3rd account
		bobAccount = new AccountStore(1000000, bobAcc);

		// setup application account
		appAccAddr = getApplicationAddress(TXN_OBJ.apid);
		applicationAccount = new AccountStore(appBalance, {
			addr: appAccAddr,
			sk: new Uint8Array(0),
		});

		// setup foreign application account
		foreignAppAccAddr = getApplicationAddress(TXN_OBJ.apfa[1]);
		foreignApplicationAccount = new AccountStore(appBalance, {
			addr: foreignAppAccAddr,
			sk: new Uint8Array(0),
		});
		
		//setup foreign application to optin application
		foreignApplicationAccount.appsTotalSchema = accInfo[0].appsTotalSchema;
		foreignApplicationAccount.appsLocalState = accInfo[0].appsLocalState;


		interpreter = new Interpreter();
		interpreter.runtime = new Runtime([elonAcc, johnAcc, bobAccount, 
			applicationAccount, foreignApplicationAccount]);
		interpreter.tealVersion = tealVersion;
		resetInterpreterState();
	};

	const executeTEAL = (tealCode: string, onComplete = TxOnComplete.NoOp): void => {
		resetInterpreterState();
		interpreter.runtime.ctx.tx.apan = Number(onComplete);
		interpreter.execute(tealCode, ExecutionMode.APPLICATION, interpreter.runtime, 0);
	};

	const executeTEALWithTxArrayChange = (tealCode: string, onComplete = TxOnComplete.NoOp): void => {
		// reset interpreter
		resetInterpreterState();
		interpreter.runtime.ctx.tx.apan = Number(onComplete);
		interpreter.runtime.ctx.tx.apat?.splice(0, 1, 
			Buffer.from(decodeAddress(foreignAppAccAddr).publicKey));
		interpreter.execute(tealCode, ExecutionMode.APPLICATION, interpreter.runtime, 0);
	};

	this.beforeAll(() => {
		setUpInterpreter(6); //setup interpreter for execute
	});

	describe("Teal cost", () => {
		useFixture("teal-files");
		beforeEach(() => {
			resetInterpreterState(); 
			interpreter.cost = 0;
			interpreter.tealVersion = 1;
		});

		it("Should return correct cost for a simple .teal program ", () => {
			const file = "test-file-1.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 3);
		});

		it("Should return correct cost for a simple .teal program ", () => {
			const file = "test-file-3.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 3);
		});

		it("Should return correct cost for a .teal program(if-else)", () => {
			const file = "test-if-else.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 9);
		});

		it("Should return correct cost for a .teal program with different version(v1)", () => {
			const file = "test-sha256-v1.teal";
			interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime);
			assert.equal(interpreter.cost, 14);
		});

		it("Should return correct cost for a .teal program for different version(v2)", () => {
			const file = "test-sha256-v2.teal";
			interpreter.execute(getProgram(file), ExecutionMode.APPLICATION, interpreter.runtime);
			assert.equal(interpreter.cost, 42);
		});

		it("Should fail when executing wrong logic teal", () => {
			// logic of teal file failed
			const file = "test-label.teal";
			expectRuntimeError(
				() =>
					interpreter.execute(getProgram(file), ExecutionMode.SIGNATURE, interpreter.runtime),
				RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
			);
		});
	});

	describe("Foreign application access", () => {
		describe("foreign application account can not be access by opcode that modify local storage", () => {
			this.beforeEach(() => {
				setUpInterpreter(7, 1e9);
			});
			it("Should throw an error when accessing account that are not in transaction's account field", () => {
				const prog = `
				txn Applications 2
				app_params_get AppAddress
				assert
				byte "X"
				byte "ABC"
				app_local_put
				`;
				 expectRuntimeError(
					() => executeTEAL(prog),
					RUNTIME_ERRORS.TEAL.ADDR_NOT_FOUND_IN_TXN_ACCOUNT
				);
			})
		})

		describe("Foreign application account can be accessed by opcode that modify local storage in specific case", () => {
			this.beforeEach(() => {
				setUpInterpreter(7, 1e9);
			});
			it("Should not throw an error when accessing account that are in transaction's account field", () => {
				const prog = `
				txn Applications 2
				app_params_get AppAddress
				assert
				byte "X"
				byte "ABC"
				app_local_put
				int 1
				`;
				
				 assert.doesNotThrow(() => executeTEALWithTxArrayChange(prog));
			})
		})
	});
});
