/**
 * Description:
 * This file deploys the stateful smart contract to create and transfer NFT
 */
const { types } = require("@algo-builder/web");
const { tryExecuteTx } = require("./transfer/common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const john = deployer.accountsByName.get("john");

	const algoTxnParams = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: masterAccount,
			toAccountAddr: john.addr,
			amountMicroAlgos: 401000000, // 401 algos
			payFlags: { note: "funding account" },
		},
	];

	await tryExecuteTx(deployer, algoTxnParams); // fund john

	await deployer
		.deployApp(
			masterAccount,
			{
				appName: "nft",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "nft_approval.py",
				clearProgramFilename: "nft_clear_state.py",
				localInts: 16,
				globalInts: 1,
				globalBytes: 63,
			},
			{}
		)
		.catch((error) => {
			throw error;
		});

	const appInfo = await deployer.getApp("nft");
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
