import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { Runtime } from "../../../src/index";
import { AccountStoreI, AppDeploymentFlags, AppInfo } from "../../../src/types";
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
			amountMicroAlgos: 1e7,
			payFlags: {
				totalFee: 1000,
			},
		};
		runtime.executeTx([fundTx]);
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
		firstApp = runtime.deployApp("c2c-call.py", "clear.teal", flags, {});
		// deploy second app
		secondApp = runtime.deployApp("c2c-echo.py", "clear.teal", flags, {});

		// fund to application
		fundToApp(alice, firstApp);
		fundToApp(alice, secondApp);

		appCallArgs = ["str:call_method", "int:1"];
	});

	it("should succeed: call another application", () => {
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
		const txReceipt = runtime.executeTx([execParams]);
		const logs = txReceipt[0].logs ?? [];
		assert.deepEqual(logs[0].substring(6), "Call from applicatiton");
	});

	it("should fail: call another application when not enough fee", () => {
		const execParams: types.ExecParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			foreignApps: [secondApp.appID],
			appID: firstApp.appID,
			appArgs: appCallArgs,
			payFlags: {
				totalFee: 1000,
			},
		};

		expectRuntimeError(
			() => runtime.executeTx([execParams]),
			RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH
		);
	});

	describe("Inner transaction in group", function () {
		it("should succeed", () => {
			const execParams: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: firstApp.appID,
				foreignApps: [secondApp.appID],
				appArgs: appCallArgs,
				payFlags: {
					totalFee: 1000,
				},
			};

			runtime.executeTx([
				execParams,
				{
					...execParams,
					appID: secondApp.appID,
					foreignApps: [firstApp.appID],
					payFlags: { totalFee: 3000 },
				},
			]);
		});

		it("should fail", () => {
			const execParams: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: firstApp.appID,
				foreignApps: [secondApp.appID],
				appArgs: appCallArgs,
				payFlags: {
					totalFee: 1000,
				},
			};

			expectRuntimeError(
				() =>
					runtime.executeTx([
						execParams,
						{
							...execParams,
							appID: secondApp.appID,
							foreignApps: [firstApp.appID],
							payFlags: { totalFee: 2000 },
						},
					]),
				RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH
			);
		});
	});

	describe("c2c call unhappy case", function () {
		let thirdApp: AppInfo;
		this.beforeEach(() => {
			thirdApp = runtime.deployApp("dummy-approval-v5.teal", "dummy-clear-v5.teal", flags, {});
			fundToApp(alice, thirdApp);
		});

		it("should fail: inner call to app implemented in older teal", () => {
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
				() => runtime.executeTx([execParams]),
				RUNTIME_ERRORS.TRANSACTION.INNER_APP_CALL_INVALID_VERSION,
				"RUNTIME_ERR1408: Inner app call in older version 5"
			);
		});

		it("should fail: inner tx app self-call", () => {
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
				() => runtime.executeTx([execParams]),
				RUNTIME_ERRORS.TRANSACTION.INNER_APP_SELF_CALL
			);
		});

		describe("Depth appl call", function () {
			const totalApp = 8;
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

			it("Should succeed: inner call with maximum depth = 8", () => {
				const execParams: types.ExecParams = {
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: alice.account,
					appID: baseApp.appID,
					// include base app so depth = 8
					appArgs: ["int:7", ...apps.map((info) => `int:${info.appID}`)],
					payFlags: {
						totalFee: 10000,
					},
				};

				assert.doesNotThrow(() => runtime.executeTx([execParams]));
			});

			it("Should fail: inner call with depth > 8", () => {
				const execParams: types.ExecParams = {
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: alice.account,
					appID: baseApp.appID,
					// include base app so depth = 9
					appArgs: ["int:8", ...apps.map((info) => `int:${info.appID}`)],
					payFlags: {
						totalFee: 1000,
					},
				};

				expectRuntimeError(
					() => runtime.executeTx([execParams]),
					RUNTIME_ERRORS.TRANSACTION.INNER_APP_DEEP_EXCEEDED
				);
				// TODO: compare runtime store and ensure it not change.
				assert.isUndefined(runtime.parentCtx);
			});
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
			assert.doesNotThrow(() => runtime.executeTx([execParams]));
			assert.isTrue(
				(console["warn"] as any).calledWith("Only supports application call in this version")
			);
		});
	});
});
