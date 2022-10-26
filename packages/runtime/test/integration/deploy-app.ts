import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { getProgram } from "../../src";
import RUNTIME_ERRORS from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AccountStoreI } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("Algorand Smart Contracts - Stateful Contract Account", function () {
	useFixture("stateful");

	let john: AccountStoreI;
	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let approvalProgram: string;
	let clearProgram: string;
	let storageConfig: types.StorageConfig;

	this.beforeAll(function () {
		runtime = new Runtime([]); // setup test
		[john] = runtime.defaultAccounts();
		approvalProgramFilename = "counter-approval.teal";
		clearProgramFilename = "clear.teal";

		approvalProgram = getProgram(approvalProgramFilename);
		clearProgram = getProgram(clearProgramFilename);

		storageConfig = {
			appName: "app",
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};
	});

	const syncAccount = (): void => {
		john = runtime.getAccount(john.address);
	};

	it("initialize new account for deployed app(s)", function () {
		// deploy new app
		const appIdX = runtime.deployApp(
			john.account,
			{
				metaType: types.MetaType.FILE,
				approvalProgramFilename,
				clearProgramFilename,
				...storageConfig,
				appName: "firstApp",
			},
			{}
		).appID;

		const appIdY = runtime.deployApp(
			john.account,
			{
				metaType: types.MetaType.SOURCE_CODE,
				approvalProgramCode: approvalProgram,
				clearProgramCode: clearProgram,
				...storageConfig,
				appName: "secondApp",
			},
			{}
		).appID;

		assert.isDefined(runtime.getApp(appIdX));
		assert.isDefined(runtime.getApp(appIdY));
		assert.isDefined(runtime.getAccount(getApplicationAddress(appIdX)));
		assert.isDefined(runtime.getAccount(getApplicationAddress(appIdY)));
	});

	it("initialize new account for app(s) deployed using executeTx", function () {
		// create new app
		const execParams: types.DeployAppParam = {
			type: types.TransactionType.DeployApp,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			appDefinition: {
				...storageConfig,
				appName: "newApp",
				metaType: types.MetaType.SOURCE_CODE,
				approvalProgramCode: approvalProgram,
				clearProgramCode: clearProgram,
			},
			payFlags: {},
		};

		runtime.executeTx([execParams]);
		syncAccount();

		const res = runtime.getAppByName("newApp");
		assert.isDefined(res);
		assert.isDefined(res?.applicationAccount);
	});

	it("Should failed if deploy duplicate app name", function () {
		expectRuntimeError(
			() =>
				runtime.deployApp(
					john.account,
					{
						metaType: types.MetaType.SOURCE_CODE,
						approvalProgramCode: approvalProgram,
						clearProgramCode: clearProgram,
						...storageConfig,
						appName: "firstApp",
					},
					{}
				),
			RUNTIME_ERRORS.GENERAL.APP_NAME_ALREADLY_USED
		);
	});

	describe('Extra Pages', function () {
		it("Should pass when program length doesn't exceeds total allowed program length", function () {
			const execParams: types.ExecParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployApp,
				appDefinition: {
					appName: "App1",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: approvalProgramFilename, // not a large approval program
					clearProgramFilename: clearProgramFilename,
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1,
					extraPages: 3
				},
				payFlags: {
					totalFee: 1000,
				},
			};

			assert.doesNotThrow(() => runtime.executeTx([execParams]));
		});

		it("Should fail when program exceeds total allowed program length", function () {
			const execParams: types.ExecParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployApp,
				appDefinition: {
					appName: "App2",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "very-long-approval.teal", // very large teal program
					clearProgramFilename: clearProgramFilename,
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1,
					extraPages: 3
				},
				payFlags: {
					totalFee: 1000,
				},
			};

			expectRuntimeError(() => runtime.executeTx([execParams]), RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED)
		});

		it("Should fail when no extra pages was defined for large approval program", function () {
			const execParams: types.ExecParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployApp,
				appDefinition: {
					appName: "App3",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "very-long-approval.teal", // very large teal program
					clearProgramFilename: clearProgramFilename,
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1
				},
				payFlags: {
					totalFee: 1000,
				},
			};

			expectRuntimeError(() => runtime.executeTx([execParams]), RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED);
		});

		it("Should pass when sufficient extra pages was defined", function () {
			const execParams: types.ExecParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployApp,
				appDefinition: {
					appName: "App",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "very-long-approval-2-pages.teal",
					clearProgramFilename: clearProgramFilename,
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1,
					extraPages: 1 // should pass because total 2 pages needed. total page = default page(1) + extra page
				},
				payFlags: {
					totalFee: 1000,
				},
			};
			assert.doesNotThrow(() => runtime.executeTx([execParams]))
		});

		it("Should fail when sufficient extra pages was not defined", function () {
			const execParams: types.ExecParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployApp,
				appDefinition: {
					appName: "App",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "very-long-approval-2-pages.teal",
					clearProgramFilename: clearProgramFilename,
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1,
					extraPages: 0 // should fail because total 2 pages needed
				},
				payFlags: {
					totalFee: 1000,
				},
			};

			expectRuntimeError(() => runtime.executeTx([execParams]), RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED);
		});

		it("Should fail when extra pages is not within the defined limit of extra pages [0,3]", function () {
			const execParams: types.ExecParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployApp,
				appDefinition: {
					appName: "App",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "very-long-approval-2-pages.teal",
					clearProgramFilename: clearProgramFilename,
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1,
					extraPages: 4 // should fail because extra pages range is [0, 3]
				},
				payFlags: {
					totalFee: 1000,
				},
			};

			expectRuntimeError(() => runtime.executeTx([execParams]), RUNTIME_ERRORS.TEAL.EXTRA_PAGES_EXCEEDED);
		});
	})
});
