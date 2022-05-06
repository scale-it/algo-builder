const { types } = require("@algo-builder/web");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const creator = deployer.accountsByName.get("master-account");

	// Create Application
	const appInfo = await deployer.deployApp(
		"handle.py",
		"clear.py",
		{
			sender: creator,
			localInts: 0,
			localBytes: 0,
			globalInts: 0,
			globalBytes: 0,
			appArgs: ["str:initialize"],
		},
		{},
		{},
		"app"
	);

	console.log(appInfo);
	console.log("Contracts deployed successfully!");

	// fund to application
	const paymentTxnParam = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		toAccountAddr: appInfo.applicationAccount,
		amountMicroAlgos: 1e8,
		payFlags: {},
	};

	await deployer.executeTx(paymentTxnParam);
}

module.exports = { default: run };
