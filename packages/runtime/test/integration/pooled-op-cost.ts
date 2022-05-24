import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const STR_NORMAL_COST = "normal_cost";

describe("TEALv5: Pooled Opcode Cost calculation", function () {
	useFixture("stateful");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let appDefinition: types.AppDefinitionFromFile;
	let appID: number;
	let appCallParam: types.AppCallsParam;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test
		approvalProgramFilename = "pooled-opcode-budget.teal";
		clearProgramFilename = "clear-pooled-opcode-budget.teal";

		appDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};

		appID = runtime.deployApp(john.account, appDefinition, {}).appID;

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

		// exceed even with 3 "normal transactions", add note to make txn different with each other
		expectRuntimeError(
			() =>
				runtime.executeTx([
					appCallParam,
					{
						...appCallParam,
						appArgs: [`str:${STR_NORMAL_COST}`],
						payFlags: { note: "salt 0" },
					},
					{
						...appCallParam,
						appArgs: [`str:${STR_NORMAL_COST}`],
						payFlags: { note: "salt 1" },
					},
					{
						...appCallParam,
						appArgs: [`str:${STR_NORMAL_COST}`],
						payFlags: { note: "salt 2" },
					},
				]), // exceeded on single
			RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
		);
	});

	it("should pass on app call with total pooled cost if enough transactions are present in group", function () {
		// enough normal cost transactions in group, add note to make txn different with each other
		const passTxGroup = [
			appCallParam,
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`], payFlags: { note: "salt 0" } },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`], payFlags: { note: "salt 1" } },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`], payFlags: { note: "salt 2" } },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`], payFlags: { note: "salt 3" } },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`], payFlags: { note: "salt 4" } },
			{ ...appCallParam, appArgs: [`str:${STR_NORMAL_COST}`], payFlags: { note: "salt 5" } },
		];

		assert.doesNotThrow(() => runtime.executeTx(passTxGroup));
	});

	describe("Combine with other transaction type", function () {
		let transferTx: types.ExecParams;
		let callAppTx: types.ExecParams;
		let increaseBudgetTx: types.ExecParams;

		this.beforeEach(async function () {
			appID = runtime.deployApp(
				john.account,
				{
					appName: "app",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "budget-opcode.teal",
					clearProgramFilename: "clearv6.teal",
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
