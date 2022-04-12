const { executeTx } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { accounts } = require("./setup");
const { ALGORAND_ACCOUNT_MIN_BALANCE } = require("@algo-builder/runtime");

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
		amountMicroAlgos: ALGORAND_ACCOUNT_MIN_BALANCE,
		payFlags: {},
	};
	await executeTx(deployer, paymentTxnParam);
}

module.exports = { default: run };
