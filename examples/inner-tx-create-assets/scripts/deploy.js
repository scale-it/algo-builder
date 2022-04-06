const { executeTx } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { APP_NAME, accounts } = require("./setup");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	// Create Application
	const appInfo = await deployer.deployApp(
		"coordinator.py",
		"clear.teal",
		{
			sender: creator,
			localInts: 0,
			localBytes: 0,
			globalInts: 0,
			globalBytes: 0,
		},
		{},
		{},
		"coordinator"
	);

	console.log(appInfo);
	console.log("Contracts deployed successfully!");

	// fund to application
	const paymentTxnParam = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		toAccountAddr: appInfo.applicationAccount,
		amountMicroAlgos: 1000000,
		payFlags: {
			totalFee: 1000,
		},
	};
	const receiptTx = await executeTx(deployer, paymentTxnParam);
	console.log(receiptTx);
}

module.exports = { default: run };
