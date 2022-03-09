import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { Runtime } from "../../../src/index";
import { AccountStoreI, AppDeploymentFlags, AppInfo, TxReceipt } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

describe("C2C call", function () {
	useFixture("c2c-call");
	let runtime: Runtime;
	let alice: AccountStoreI;
	let firstApp: AppInfo;
	let secondApp: AppInfo;

	let appCallArgs: string[];

	let flags: AppDeploymentFlags;

	function fundToApp(funder: AccountStoreI, appInfo: AppInfo) {
		const fundTx: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: funder.account,
			toAccountAddr: appInfo.applicationAccount,
			amountMicroAlgos: 1e6,
			payFlags: {
				totalFee: 1000,
			},
		};
		runtime.executeTx(fundTx);
	}

	this.beforeEach(() => {
		runtime = new Runtime([]);
		[alice] = runtime.defaultAccounts();
		flags = {
			sender: alice.account,
			localBytes: 1,
			globalBytes: 1,
			localInts: 1,
			globalInts: 1,
		};
		// deploy first app
		// eslint-disable-next-line sonarjs/no-duplicate-string
		firstApp = runtime.deployApp("c2c-call.teal", "clear.teal", flags, {});
		// deploy second app
		secondApp = runtime.deployApp("c2c-echo.teal", "clear.teal", flags, {});

		// fund to application
		fundToApp(alice, firstApp);
		fundToApp(alice, secondApp);

		appCallArgs = ["str:call_method", "int:1"];
	});

	it("can call another application", () => {
		const execParams: types.ExecParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			foreignApps: [secondApp.appID],
			appID: firstApp.appID,
			appArgs: appCallArgs,
			payFlags: {
				totalFee: 2000,
			},
		};
		const txReceipt = runtime.executeTx(execParams) as TxReceipt;
		const logs = txReceipt.logs ?? [];
		assert.deepEqual(logs[0].substring(6), "Call from applicatiton");
	});

	describe("c2c call unhappy case", function () {
		let thirdApp: AppInfo;
		this.beforeEach(() => {
			thirdApp = runtime.deployApp("dummy-approval-v5.teal", "dummy-clear-v5.teal", flags, {});
			fundToApp(alice, thirdApp);
		});

		it("should failed: inner call to app implemented in older teal", () => {
			const execParams: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				foreignApps: [thirdApp.appID],
				appID: firstApp.appID,
				appArgs: appCallArgs,
				payFlags: {
					totalFee: 2000,
				},
			};

			expectRuntimeError(
				() => runtime.executeTx(execParams),
				RUNTIME_ERRORS.GENERAL.INNER_APP_CALL_INVALID_VERSION,
				"RUNTIME_ERR1508: Inner app call in older version 5"
			);
		});

		it("should failed: inner tx appl self-call", () => {
			const execParams: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				foreignApps: [firstApp.appID],
				appID: firstApp.appID,
				appArgs: appCallArgs,
				payFlags: {
					totalFee: 2000,
				},
			};

			expectRuntimeError(
				() => runtime.executeTx(execParams),
				RUNTIME_ERRORS.GENERAL.INNER_APPL_SELF_CALL
			);
		});
	});

	describe("Depth call limit at 8", function () {
		const totalApp = 8;
		// eslint-disable-next-line sonarjs/no-unused-collection
		let apps: AppInfo[];
		let baseApp: AppInfo;
		let bob: AccountStoreI;
		this.beforeEach(() => {
			apps = [];
			bob = runtime.defaultAccounts()[1];
			flags.sender = bob.account;
			baseApp = runtime.deployApp("seq-call.py", "clear.teal", flags, {});
			fundToApp(bob, baseApp);
			for (let id = 0; id < totalApp; ++id) {
				const curApp = runtime.deployApp("seq-call.py", "clear.teal", flags, {});
				fundToApp(bob, curApp);
				apps.push(curApp);
			}
		});

		it("Should failed: inner call with maxium depth = 8", () => {
			const execParams: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: baseApp.appID,
				appArgs: ["int:8", ...apps.map((info) => `int:${info.appID}`)],
				payFlags: {
					totalFee: 10000,
				},
			};
			runtime.executeTx(execParams);
		});
	});

	describe("Only support application call for now", function () {
		let execParams: types.ExecParams;
		this.beforeEach(() => {
			const appInfo = runtime.deployApp("inner-tx-deploy.py", "clear.teal", flags, {});

			execParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: appInfo.appID,
				payFlags: {
					totalFee: 2000,
				},
			};
		});

		it("Should not support other inner tx appl(not include appcall)", () => {
			assert.doesNotThrow(() => runtime.executeTx(execParams));
			assert.isTrue(
				(console["warn"] as any).calledWith("Only support application call in this version")
			);
		});
	});
});
