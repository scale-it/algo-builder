import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { getProgram } from "../../src";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - Stateful Contract Account", function () {
	useFixture("stateful");
	const fee = 1000;
	const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + fee;
	let john = new AccountStore(minBalance + fee);

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let approvalProgram: string;
	let clearProgram: string;
	let storageConfig: types.StorageConfig;
	this.beforeAll(function () {
		runtime = new Runtime([john]); // setup test
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
				metaType: types.MetaType.SOURCE_CODE,
				approvalProgramCode: approvalProgram,
				clearProgramCode: clearProgram,
			},
			payFlags: {},
		};

		runtime.executeTx([execParams]);
		syncAccount();

		const res = runtime.getAppByName(storageConfig.appName);
		assert.isDefined(res);
		assert.isDefined(res?.applicationAccount);
	});
});
