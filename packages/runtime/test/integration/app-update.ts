import { types } from "@algo-builder/web";
import { assert } from "chai";

import { getProgram } from "../../src";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("App Update Test", function () {
	useFixture("app-update");
	this.timeout(0);
	const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + 1000; // 1000 to cover fee
	const john = new AccountStore(1e30);
	const alice = new AccountStore(minBalance + 1000);

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let approvalProgram: string;
	let clearProgram: string;
	let appID: number;
	let groupTx: types.UpdateAppParam[];

	this.beforeEach(async function () {
		runtime = new Runtime([john, alice]); // setup test

		approvalProgramFilename = "approval_program.py";
		clearProgramFilename = "clear_program.teal";
		approvalProgram = getProgram(approvalProgramFilename);
		clearProgram = getProgram(clearProgramFilename);

		const appDefinition: types.AppDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			globalBytes: 5,
			globalInts: 5,
			localBytes: 5,
			localInts: 5,
		};

		appID = runtime.deployApp(john.account, appDefinition, {}).appID;

		groupTx = [
			{
				appName: "app",
				type: types.TransactionType.UpdateApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appID,
				newAppCode: {
					metaType: types.MetaType.FILE,
					approvalProgramFilename,
					clearProgramFilename,
				},
				payFlags: {},
				appArgs: ["int:2"],
			},
			{
				appName: "app",
				type: types.TransactionType.UpdateApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appID,
				newAppCode: {
					metaType: types.MetaType.SOURCE_CODE,
					approvalProgramCode: approvalProgram,
					clearProgramCode: clearProgram,
				},
				payFlags: {},
				appArgs: ["int:5"],
			},
		];
	});

	/**
	 * Create 2 transactions in a group: `app_update(n=2), app_update(n=5)`.
	 * Check the expected `app.counter == 2, app.total=7`
	 */
	it("First case: (app_update(n=2) + app_update(n=5))", function () {
		runtime.executeTx(groupTx);

		const globalCounter = runtime.getGlobalState(appID, "counter");
		const total = runtime.getGlobalState(appID, "total");
		assert(globalCounter === 2n, "failed counter");
		assert(total === 7n, "failed total");
	});

	/**
	 * Create 2 transactions in a group: `app_update(n=5), app_update(n=2)`.
	 * Check the expected `app.counter == 2, app.total=13`
	 */
	it("Second case: (app_update(n=5) + app_update(n=2))", function () {
		groupTx[0].appArgs = ["int:5"];
		groupTx[1].appArgs = ["int:2"];

		runtime.executeTx(groupTx);

		const globalCounter = runtime.getGlobalState(appID, "counter");
		const total = runtime.getGlobalState(appID, "total");
		assert(globalCounter === 2n, "failed counter");
		assert(total === 13n, "failed total");
	});

	/**
	 * Run tx group: `app_update(n=2), app_update(n=5)` in a loop 1000 times.
	 * This should fail because TEAL doesn't support negative numbers, and while looping
	 * negative number is encountered
	 */
	it("Third case: (app_update(n=2) + app_update(n=5)) * 1000", function () {
		expectRuntimeError(function () {
			for (let i = 0; i < 1000; ++i) {
				runtime.executeTx(groupTx);
			}
		}, RUNTIME_ERRORS.TEAL.UINT64_UNDERFLOW);
	});

	/**
	 * Run tx group: `app_update(n=5), app_update(n=2)` in a loop 100 times.
	 * The expected state should be: `app.counter == 200`, `app.total = 310
	 * TODO: Improve for 1000 times. Runtime seem like slower than before...
	 */
	it("Fourth case: (app_update(n=5) + app_update(n=2)) * 100", async function () {
		groupTx[0].appArgs = ["int:5"];
		groupTx[1].appArgs = ["int:2"];

		for (let i = 0; i < 100; ++i) {
			runtime.executeTx(groupTx);
		}

		const globalCounter = runtime.getGlobalState(appID, "counter");
		const total = runtime.getGlobalState(appID, "total");
		assert.equal(globalCounter, 200n, "counter mismatch");
		assert.equal(total, 310n, "total mismatch");
	});
});
