const { types } = require("@algo-builder/web");
const { tryExecuteTx } = require("./common/common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const creatorAccount = deployer.accountsByName.get("alice");

	const algoTxnParams = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: creatorAccount.addr,
		amountMicroAlgos: 200e6,
		payFlags: {},
	};
	// transfer some algos to creator account
	await tryExecuteTx(deployer, [algoTxnParams]);

	// Create Application
	// Note: An Account can have maximum of 10 Applications.
	const sscInfo = await deployer
		.deployApp(
			creatorAccount,
			{
				appName: "CounterApp",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "approval_program.teal", // approval program
				clearProgramFilename: "clear_program.teal", // clear program
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
			},
			{}
		)
		.catch((error) => {
			throw error;
		});

	console.log(sscInfo);

	// Opt-In for creator
	await deployer.optInAccountToApp(creatorAccount, sscInfo.appID, {}, {}).catch((error) => {
		throw error;
	});
}

module.exports = { default: run };
