const { Runtime } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
import { assert } from "chai";

describe("Group txn", function () {
	let runtime;
	let creator;
	let proxyAppInfo;
	this.beforeEach(() => {
		runtime = new Runtime([]);
		[creator] = runtime.defaultAccounts();
		proxyAppInfo = runtime.deployApp(
			creator.account,
			{
				appName: "coordinator",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "coordinator.py",
				clearProgramFilename: "clear.teal",
				localInts: 0,
				localBytes: 0,
				globalInts: 0,
				globalBytes: 0,
			},
			{},
			{}
		);
	});

	it("Should create new app and asset from group id", () => {
		// first tx in group: deploy new app
		// the same code is used for coordinator contract
		const createAppTxnParam = {
			type: types.TransactionType.DeployApp,
			sign: types.SignType.SecretKey,
			fromAccount: creator.account,
			appDefinition: {
				appName: "appName",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "coordinator.py",
				clearProgramFilename: "clear.teal",
				localInts: 0,
				localBytes: 0,
				globalInts: 0,
				globalBytes: 0,
			},
			payFlags: {
				totalFee: 1000,
			},
		};

		// second tx : create asset
		const createASATxnParam = {
			type: types.TransactionType.DeployASA,
			sign: types.SignType.SecretKey,
			fromAccount: creator.account,
			asaName: "gold",
			payFlags: {
				totalFee: 1000,
			},
		};

		// third tx: call master app
		const masterTxnParam = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: creator.account,
			appID: proxyAppInfo.appID,
			appArgs: ["str:create_by_group_txn"],
			payFlags: {
				totalFee: 2000,
			},
		};

		const receiptsTx = runtime.executeTx([
			createAppTxnParam,
			createASATxnParam,
			masterTxnParam,
		]);

		// verify new applicationId and assetId
		const lastReceipt = receiptsTx[receiptsTx.length - 1];
    const decoder = new TextDecoder();
		const applicationId = decoder.decode(lastReceipt.logs[0]);
		const assetId = decoder.decode(lastReceipt.logs[1]);

		assert.isTrue(Number(applicationId) > 0);
		assert.isTrue(Number(assetId) > 0);
	});
});
