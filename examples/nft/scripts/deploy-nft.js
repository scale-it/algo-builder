/**
 * Description:
 * This file deploys the stateful smart contract to create and transfer NFT
 */
const { types } = require("@algo-builder/web");
const { executeTx } = require("./transfer/common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const john = deployer.accountsByName.get("john");

	const algoTxnParams = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: john.addr,
		amountMicroAlgos: 401000000, // 401 algos
		payFlags: { note: "funding account" },
	};

	await deployer.executeTx(algoTxnParams); // fund john

	await deployer.deployApp(
		"nft_approval.py",
		"nft_clear_state.py",
		{
			sender: masterAccount,
			localInts: 16,
			globalInts: 1,
			globalBytes: 63,
		},
		{}
	);

	const appInfo = await deployer.getAppByFile("nft_approval.py", "nft_clear_state.py");
	const appID = appInfo.appID;
	console.log(appInfo);

	try {
		await deployer.optInAccountToApp(masterAccount, appID, {}, {}); // opt-in to asc by master
		await deployer.optInAccountToApp(john, appID, {}, {}); // opt-in to asc by john
	} catch (e) {
		console.log(e);
		throw new Error(e);
	}
}

module.exports = { default: run };
