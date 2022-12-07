/**
 * Descrpition:
 * This function deploy the app for the first time
 */
const { types } = require("@algo-builder/web");
const { balanceOf } = require("@algo-builder/algob");
const { tryExecuteTx } = require("./common/common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const john = deployer.accountsByName.get("john");

	//Create app from john
	const algoTxnParams = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: masterAccount,
			toAccountAddr: john.addr,
			amountMicroAlgos: 100000000, // 100 algos
			payFlags: { note: "funding account" },
		},
	];

	await tryExecuteTx(deployer, algoTxnParams); // execute Create app transaction

	await deployer
		.deployApp(
			john,
			{
				appName: "proxy_trampoline",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
				localInts: 0,
				localBytes: 0,
				globalInts: 0,
				globalBytes: 0,
			},
			{}
		) // execute create App Transction
		.catch((error) => {
			throw error;
		});

	const appInfo = await deployer.getApp("proxy_trampoline");
	console.log(appInfo);

	//transfer algo to app proxy
	const algoTxnFundProxy = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: john,
			toAccountAddr: appInfo.applicationAccount,
			amountMicroAlgos: 1000000, // 1 algos
			payFlags: { note: "funding application" },
		},
	];
	await tryExecuteTx(deployer, algoTxnFundProxy);
	console.log(
		"Balance of application: ",
		await balanceOf(deployer, appInfo.applicationAccount)
	);
}

module.exports = { default: run };
