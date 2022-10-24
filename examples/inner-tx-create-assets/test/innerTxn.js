const { Runtime } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { assert } = require("chai");

describe("Group txn", function () {
	let runtime;
	let creator;
	let proxyAppInfo;
	this.beforeEach(function () {
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
			{}
		);

		const paymentTxnParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: creator.account,
			toAccountAddr: proxyAppInfo.applicationAccount,
			amountMicroAlgos: 30000000,
			payFlags: {},
		};

		runtime.executeTx([paymentTxnParam]);
	});

	it.only("Should create new app and asset from inner txn", function () {
		// create asset and log new asset id
		const masterTxnParam = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: creator.account,
			appID: proxyAppInfo.appID,
			appArgs: ["str:create_by_inner_txn"],
			payFlags: {
				totalFee: 3000,
			},
		};

		const txReceipt = runtime.executeTx([masterTxnParam]);

		// get logs from transaction
		const logs = txReceipt[0].logs;
		const decoder = new TextDecoder();
		const assetId = decoder.decode(logs[0]);
		const applicationId = decoder.decode(logs[1]);

		// creating an application by inner txn is not supported yet
		// so applicationId will equal zero.
		assert.isTrue(Number(applicationId) == 0);
		assert.isTrue(Number(assetId) > 0);
	});
});
