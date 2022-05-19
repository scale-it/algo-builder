const { executeTx } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { bytesToBigInt } = require("algosdk");
const { accounts, decodeValue } = require("../utils");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	const proxyAppInfo = deployer.getApp("coordinator");

	// first tx in group: deploy new app
	// btw we're using same code with coordinator contract.
	const createAppTxnParam = {
		type: types.TransactionType.DeployApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		approvalProgram: "coordinator.py",
		clearProgram: "clear.teal",
		localInts: 0,
		localBytes: 0,
		globalInts: 0,
		globalBytes: 0,
		payFlags: {
			totalFee: 1000,
		},
	};

	// second tx : create asset
	const createASATxnParam = {
		type: types.TransactionType.DeployASA,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		asaName: "gold",
		payFlags: {
			totalFee: 1000,
		},
	};

	// third tx: call master app
	const masterTxnParam = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		appID: proxyAppInfo.appID,
		appArgs: ["str:create_by_group_txn"],
		payFlags: {
			totalFee: 2000,
		},
	};

	const receiptsTx = await deployer.executeTx([
		createAppTxnParam,
		createASATxnParam,
		masterTxnParam,
	]);

	// log created asset id and application id
	const lastReceipt = receiptsTx[receiptsTx.length - 1];
	console.log("new application id:", decodeValue(lastReceipt.logs[0]));
	console.log("new asset id:", decodeValue(lastReceipt.logs[1]));
}

module.exports = { default: run };
