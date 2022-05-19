const { executeTx } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { accounts } = require("./utils");

const min_balance = 3000000;

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
		amountMicroAlgos: min_balance,
		payFlags: {},
	};
	await deployer.executeTx(paymentTxnParam);
}

module.exports = { default: run };
