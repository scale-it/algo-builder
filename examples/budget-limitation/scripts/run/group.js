const { types } = require("@algo-builder/web");
const { default: algosdk } = require("algosdk");

async function run(runtimeEnv, deployer) {
	const master = deployer.accountsByName.get("master-account");

	const appInfo = deployer.getApp("app");

	const baseTxn = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: master,
		appArgs: ["str:call"],
		appID: appInfo.appID,
		payFlags: { totalFee: 1000 },
	};
	const receipt = await deployer.executeTx([baseTxn]);

	console.log(algosdk.bytesToBigInt(receipt[0].logs[0]));
}

module.exports = { default: run };
