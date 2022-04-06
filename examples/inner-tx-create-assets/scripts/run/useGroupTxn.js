const { executeTx } = require("@algo-builder/algob");
const { ALGORAND_ACCOUNT_MIN_BALANCE } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { APP_NAME, accounts } = require("../setup");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	const proxyAppInfo = deployer.getApp("coordinator");

	//  first tx in group: deploy app
	const createAppTxnParam = {
		type: types.TransactionType.DeployApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		approvalProgram: "logger.py",
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

	const receiptTx = await executeTx(deployer, [
		createAppTxnParam,
		createASATxnParam,
		masterTxnParam,
	]);

	console.log(receiptTx);
}

module.exports = { default: run };
