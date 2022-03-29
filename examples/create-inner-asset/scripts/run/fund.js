const { executeTx } = require("@algo-builder/algob");
const { ALGORAND_ACCOUNT_MIN_BALANCE } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { APP_NAME, accounts } = require("../setup");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	const proxyAppInfo = deployer.getApp(APP_NAME);

	//  first tx in group: deploy app
	const createAppTxnParam = {
		type: types.TransactionType.DeployApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		approvalProgram: "app.py",
		clearProgram: "clear.teal",
		localInts: 0,
		localBytes: 0,
		globalInts: 0,
		globalBytes: 0,
		appName: "NewApp", // TODO: better name ???
		payFlags: {
			totalFee: 1000,
		},
	};

	// second tx : payment

	const paymentTxnParam = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		toAccountAddr: proxyAppInfo.applicationAccount,
		amountMicroAlgos: 2e5,
		payFlags: {
			totalFee: 1000,
		},
	};

	// third tx: call proxy app

	const proxyTxnParam = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		appID: proxyAppInfo.appID,
		appArgs: ["str:fund"],
		payFlags: {
			totalFee: 2000,
		},
	};

	await executeTx(deployer, [createAppTxnParam, paymentTxnParam, proxyTxnParam]);

	const newAppInfo = deployer.getApp("NewApp");

	console.log(newAppInfo);
}

module.exports = { default: run };
