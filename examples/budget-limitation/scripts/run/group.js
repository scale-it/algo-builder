const { types } = require("@algo-builder/web");
const { default: algosdk } = require("algosdk");

async function run(runtimeEnv, deployer) {
	const master = deployer.accountsByName.get("master-account");

	const appInfo = deployer.getApp("App");

	const baseTxn = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: master,
		appArgs: ["str:call"],
		appID: appInfo.appID,
		payFlags: { totalFee: 1000 },
	};

	const anotherTxn = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: master,
		appArgs: ["str:call"],
		appID: appInfo.appID,
		payFlags: { totalFee: 1000, note: "Second" },
	};

	// not throw any error
	const receipt = await deployer.executeTx([baseTxn]);
	console.log(algosdk.bytesToBigInt(receipt[0].logs[0]));

	// throw error because total inner transaction more than 256
	try {
		await deployer.executeTx([baseTxn, anotherTxn]);
	} catch (e) {
		console.log(e.message);
	}
}

module.exports = { default: run };
