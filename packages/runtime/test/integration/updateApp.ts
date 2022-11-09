import { parsing, types } from "@algo-builder/web";
import { assert } from "chai";

import { getProgram } from "../../src";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const approvalStr = "approval-program";
describe("Algorand Smart Contracts - Update Application", function () {
	useFixture("stateful-update");
	const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 20 + 1000; // 1000 to cover fee
	let creator = new AccountStore(minBalance + 1000);
	const alice = new AccountStore(minBalance + 1000);

	let runtime: Runtime;
	let oldApprovalProgramFileName: string;
	let newApprovalProgramFileName: string;
	let clearProgramFilename: string;

	let oldApprovalProgram: string;
	let newApprovalProgram: string;
	let clearProgram: string;
	let appID: number;
	const storageConfig = {
		appName: "app",
		globalBytes: 4,
		globalInts: 4,
		localBytes: 2,
		localInts: 2,
	};
	this.beforeAll(async function () {
		runtime = new Runtime([creator, alice]);

		oldApprovalProgramFileName = "oldapproval.teal";
		newApprovalProgramFileName = "newapproval.teal";
		clearProgramFilename = "clear.teal";

		oldApprovalProgram = getProgram(oldApprovalProgramFileName);
		newApprovalProgram = getProgram(newApprovalProgramFileName);
		clearProgram = getProgram(clearProgramFilename);
	});

	it("should fail during update application if app id is not defined", function () {
		expectRuntimeError(
			() =>
				runtime.updateApp(
					"app",
					creator.address,
					1111,
					{
						metaType: types.MetaType.FILE,
						approvalProgramFilename: oldApprovalProgramFileName,
						clearProgramFilename: clearProgramFilename,
					},
					{},
					{}
				),
			RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
		);
	});

	it("should update application", function () {
		appID = runtime.deployApp(
			creator.account,
			{
				metaType: types.MetaType.FILE,
				approvalProgramFilename: oldApprovalProgramFileName,
				clearProgramFilename,
				...storageConfig,
			},
			{}
		).appID;
		runtime.optInToApp(creator.address, appID, {}, {});

		// check deploy app params
		let app = runtime.getApp(appID);
		assert.isDefined(app);
		assert.deepEqual(app[approvalStr], oldApprovalProgram);
		assert.deepEqual(app["clear-state-program"], clearProgram);

		runtime.updateApp(
			storageConfig.appName,
			creator.address,
			appID,
			{
				metaType: types.MetaType.SOURCE_CODE,
				approvalProgramCode: newApprovalProgram,
				clearProgramCode: clearProgram,
			},
			{},
			{}
		);
		app = runtime.getApp(appID);

		// check if program & state is updated after tx execution
		assert.deepEqual(app[approvalStr], newApprovalProgram);
		assert.deepEqual(
			runtime.getGlobalState(appID, "global-key"),
			parsing.stringToBytes("global-val")
		);
		assert.deepEqual(
			runtime.getLocalState(appID, creator.address, "local-key"),
			parsing.stringToBytes("local-val")
		);

		// now call the smart contract after updating approval program which checks for
		// global-key and local-key in state (which was set during the update from oldApprovalProgram)
		const noOpParams: types.AppCallsParam = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: creator.account,
			appID: appID,
			payFlags: { totalFee: 1000 },
		};
		runtime.executeTx([noOpParams]);
		creator = runtime.getAccount(creator.address);

		// check state set by the 'new' approval program
		assert.deepEqual(
			runtime.getGlobalState(appID, "new-global-key"),
			parsing.stringToBytes("new-global-val")
		);
		assert.deepEqual(
			runtime.getLocalState(appID, creator.address, "new-local-key"),
			parsing.stringToBytes("new-local-val")
		);
	});

	it("should not update application if logic is rejected", function () {
		// create app
		appID = runtime.deployApp(
			creator.account,
			{
				metaType: types.MetaType.FILE,
				approvalProgramFilename: oldApprovalProgramFileName,
				clearProgramFilename,
				...storageConfig,
				appName: "RejectUpdate",
			},
			{}
		).appID;
		runtime.optInToApp(creator.address, appID, {}, {});

		let app = runtime.getApp(appID);
		assert.isDefined(app);
		assert.deepEqual(app[approvalStr], oldApprovalProgram);

		expectRuntimeError(
			() =>
				runtime.updateApp(
					storageConfig.appName,
					alice.address,
					appID,
					{
						metaType: types.MetaType.SOURCE_CODE,
						approvalProgramCode: newApprovalProgram,
						clearProgramCode: clearProgram,
					},
					{},
					{}
				),
			RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
		);

		// verify approval program & state is not updated as tx is rejected
		app = runtime.getApp(appID);
		assert.deepEqual(app[approvalStr], oldApprovalProgram);
		assert.deepEqual(runtime.getGlobalState(appID, "global-key"), undefined);
		assert.deepEqual(runtime.getLocalState(appID, creator.address, "local-key"), undefined);
	});

	describe("Extra Pages", function () {
		useFixture("stateful");
		const storageConfig = {
			appName: "app",
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};

		this.beforeAll(function () {
			oldApprovalProgramFileName = "counter-approval.teal";
			clearProgramFilename = "clear.teal";
		});

		function deployApp(approvalProgramFilename: string, clearProgramFilename: string, appName: string) {
			const appID = runtime.deployApp(
				creator.account,
				{
					metaType: types.MetaType.FILE,
					approvalProgramFilename: approvalProgramFilename,
					clearProgramFilename: clearProgramFilename,
					...storageConfig,
					appName: appName,
				},
				{}
			).appID;
			return appID;
		}

		function updateApp(approvalProgramFilename: string, clearProgramFilename: string, appName: string, extraPages: number = 0) {
			runtime.updateApp(
				appName,
				creator.address,
				appID,
				{
					metaType: types.MetaType.FILE,
					approvalProgramFilename: approvalProgramFilename,
					clearProgramFilename: clearProgramFilename,
					extraPages: extraPages
				},
				{},
				{}
			)
		}

		it("Should pass when updated program length does not exceed total allowed program length", function () {
			// create app
			appID = deployApp(oldApprovalProgramFileName, clearProgramFilename, "app1");
			runtime.optInToApp(creator.address, appID, {}, {});

			let app = runtime.getApp(appID);
			assert.isDefined(app);

			assert.doesNotThrow(
				() => updateApp("counter-approval.teal", "clear.teal", "app1")
			);

			// verify updated app
			assert.isDefined(runtime.getApp(appID));
		});

		it("Should fail when updated program length exceeds total allowed program length", function () {
			// create app
			appID = deployApp(oldApprovalProgramFileName, clearProgramFilename, "app2");
			runtime.optInToApp(creator.address, appID, {}, {});

			const app = runtime.getApp(appID);
			assert.isDefined(app);

			expectRuntimeError(
				() => updateApp("very-long-approval.teal", "clear.teal", "app2"),
				RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED
			);
		});

		it("Should fail when no extra pages were defined for large approval program", function () {
			// create app
			appID = deployApp(oldApprovalProgramFileName, clearProgramFilename, "app3");
			runtime.optInToApp(creator.address, appID, {}, {});

			const app = runtime.getApp(appID);
			assert.isDefined(app);

			expectRuntimeError(
				() => updateApp("very-long-approval.teal", "clear.teal", "app3"),
				RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED
			);
		});

		it("Should pass when sufficient extra pages was defined", function () {
			// create app
			appID = deployApp(oldApprovalProgramFileName, clearProgramFilename, "app4");
			runtime.optInToApp(creator.address, appID, {}, {});

			const app = runtime.getApp(appID);
			assert.isDefined(app);

			// should pass because total 2 pages(1 + extra pages) needed
			assert.doesNotThrow(
				() => updateApp("very-long-approval-2-pages.teal", "clear.teal", "app4", 1),
			);

			// verify updated app
			assert.isDefined(runtime.getApp(appID));
		});

		it("Should fail when sufficient extra pages was not defined", function () {
			// create app
			appID = deployApp(oldApprovalProgramFileName, clearProgramFilename, "app5");
			runtime.optInToApp(creator.address, appID, {}, {});

			const app = runtime.getApp(appID);
			assert.isDefined(app);

			// should fail because total 2 pages (1 + extra pages) needed because: program length > 2048
			expectRuntimeError(
				() => updateApp("very-long-approval-2-pages.teal", "clear.teal", "app5", 0),
				RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED
			);
		});

		it("Should fail when sufficient extra pages was not defined", function () {
			// create app
			appID = deployApp(oldApprovalProgramFileName, clearProgramFilename, "app6");
			runtime.optInToApp(creator.address, appID, {}, {});

			const app = runtime.getApp(appID);
			assert.isDefined(app);

			// should fail because extra pages range is [0, 3]
			expectRuntimeError(
				() => updateApp("very-long-approval-2-pages.teal", "clear.teal", "app6", 4),
				RUNTIME_ERRORS.TEAL.EXTRA_PAGES_EXCEEDED
			);
		});

	});

});
