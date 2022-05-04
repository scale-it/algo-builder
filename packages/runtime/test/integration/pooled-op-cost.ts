import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const STR_NORMAL_COST = "normal_cost";

describe("TEALv5: Pooled Opcode Cost calculation", function () {
	useFixture("stateful");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgramFileName: string;
	let clearProgramFileName: string;
	let flags: AppDeploymentFlags;
	let appID: number;
	let appCallParam: types.AppCallsParam;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test
		approvalProgramFileName = "pooled-opcode-budget.teal";
		clearProgramFileName = "clear-pooled-opcode-budget.teal";

		flags = {
			sender: john.account,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};

		appID = runtime.deployApp(approvalProgramFileName, clearProgramFileName, flags, {}).appID;

		appCallParam = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			appID: appID,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:exceeded_cost"],
		};
	});

	it("should fail on application call if total pooled cost exceeds", function () {
		expectRuntimeError(
			() => runtime.executeTx([appCallParam]), // exceeded on single
			RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
		);

		// exceed even with 3 "normal transactions"
		expectRuntimeError(
			() =>
				runtime.executeTx([
					appCallParam,
					{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
					{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
					{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
				]), // exceeded on single
			RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
		);
	});

	it("should pass on app call with total pooled cost if enough transactions are present in group", function () {
		// enough normal cost transactions in group
		const passTxGroup = [
			appCallParam,
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`] },
		];

		assert.doesNotThrow(() => runtime.executeTx(passTxGroup));
	});

	describe("Combine with other transaction type", function () {
		let transferTx: types.ExecParams;
		let callAppTx: types.ExecParams;
		let increaseBudgetTx: types.ExecParams;

		this.beforeEach(async function () {
			appID = runtime.deployApp(
				"budget-opcode.teal",
				"clearv6.teal",
				{
					sender: john.account,
					globalBytes: 0,
					globalInts: 0,
					localBytes: 0,
					localInts: 0,
				},
				{}
			).appID;

			transferTx = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				toAccountAddr: john.address,
				amountMicroAlgos: 0,
				payFlags: { totalFee: 1000 },
			};

			callAppTx = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appID,
				appArgs: ["str:worker"],
				payFlags: {
					totalFee: 1000,
				},
			};

			increaseBudgetTx = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appID,
				appArgs: ["str:budget"],
				payFlags: {
					totalFee: 1000,
				},
			};
		});

		it("Should succeed because enough budget when group 2 appl call transaction(1400)", () => {
			assert.doesNotThrow(() => runtime.executeTx([increaseBudgetTx, callAppTx]));
		});

		it("Should failed because budget only from call appl(700)", () => {
			expectRuntimeError(
				() => runtime.executeTx([callAppTx, transferTx]),
				RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
			);
		});
	});
});
