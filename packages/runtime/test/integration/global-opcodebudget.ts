import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, getProgram, Runtime } from "../../src/index";
import { LogicSigAccount } from "../../src/logicsig";
import { AccountStoreI, AppDeploymentFlags } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const STR_NORMAL_COST = "normal_cost";

describe("TEALv5: Pooled Opcode Cost calculation", function () {
	useFixture("global-opcodebudget");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let flags: AppDeploymentFlags;
	let appID: number;
	let dummyAppID: number;
	let txnParam: types.ExecParams;
	let lsig: LogicSigAccount;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test

		flags = {
			sender: john.account,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};

		// appID = runtime.deployApp('app.teal', 'clear.teal', flags, {}).appID;

		// dummyAppID = runtime.deployApp('dummy-app.teal', 'clear.teal', flags, {}).appID;

		lsig = runtime.createLsigAccount(getProgram("lsig.teal"), []);

		runtime.fundLsig(john.account, lsig.address(), 1e6);
	});

	it("Should pass signature logic", function () {
		txnParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			lsig: lsig,
			fromAccountAddr: lsig.address(),
			toAccountAddr: john.address,
			amountMicroAlgos: 0n,
			payFlags: {
				totalFee: 1000,
			},
		};

		runtime.executeTx([txnParam]);
		assert.doesNotThrow(() => runtime.executeTx([txnParam]));
	});
});
