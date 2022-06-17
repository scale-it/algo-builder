const { types } = require("@algo-builder/web");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const creator = deployer.accountsByName.get("master-account");

	// Create Application
	const appInfo = await deployer.deployApp(
		creator,
		{
			appName: "App",
			metaType: types.MetaType.FILE,
			approvalProgramFilename: "handle.py", // approval program
			clearProgramFilename: "clear.py", // clear program
			localInts: 1,
			localBytes: 1,
			globalInts: 1,
			globalBytes: 1,
		},
		{}
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
