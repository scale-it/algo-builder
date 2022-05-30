const { Runtime } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");

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
		// btw we're using same code with coordinator contract.
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

		// log created asset id and application id
		const lastReceipt = receiptsTx[receiptsTx.length - 1];
		console.log("new application id:", new TextDecoder().decode(lastReceipt.logs[0]));
		console.log("new asset id:", new TextDecoder().decode(lastReceipt.logs[1]));
	});
});
