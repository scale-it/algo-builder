const { convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { tryExecuteTx } = require("./vote/common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const alice = deployer.accountsByName.get("alice");
	const votingAdminAccount = deployer.accountsByName.get("john");

	const algoTxnParams = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: votingAdminAccount.addr,
		amountMicroAlgos: 200000000,
		payFlags: {},
	};
	await tryExecuteTx(deployer, algoTxnParams);

	algoTxnParams.toAccountAddr = alice.addr;
	await tryExecuteTx(deployer, algoTxnParams);

	// Create ASA - Vote Token
	const asaInfo = await deployer
		.deployASA("vote-token", { creator: votingAdminAccount })
		.catch((error) => {
			throw error;
		});
	console.log(asaInfo);

	// Transfer 1 vote token to alice.
	const txnParam = {
		type: types.TransactionType.TransferAsset,
		sign: types.SignType.SecretKey,
		fromAccount: votingAdminAccount,
		toAccountAddr: alice.addr,
		amount: 1,
		assetID: asaInfo.assetIndex,
		payFlags: { note: "Sending Vote Token" },
	};
	await tryExecuteTx(deployer, txnParam);

	// Get last round and Initialize rounds
	const status = await deployer.algodClient.status().do();
	console.log("Last Round: ", status["last-round"]);
	const regBegin = status["last-round"];
	const regEnd = regBegin + 10;
	const voteBegin = regBegin + 2;
	const voteEnd = voteBegin + 1000;

	// store asset Id of vote token created in this script
	const assetID = asaInfo.assetIndex;
	const appArgs = [regBegin, regEnd, voteBegin, voteEnd, assetID].map(
		convert.uint64ToBigEndian
	);

	// Create Application
	// Note: An Account can have maximum of 10 Applications.
	const res = await deployer
		.deployApp(
			votingAdminAccount,
			{
				appName: "PermissionedVotingApp",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "permissioned-voting-approval.py",
				clearProgramFilename: "permissioned-voting-clear.py",
				localInts: 0,
				localBytes: 1,
				globalInts: 6,
				globalBytes: 1,
				appArgs: appArgs,
			},
			{}
		)
		.catch((error) => {
			throw error;
		});

	console.log(res);

	// Register Alice in voting application
	const reg = [convert.stringToBytes("register")];

	console.log("Opting-In for Alice in voting application");
	try {
		await deployer.optInAccountToApp(alice, res.appID, {}, { appArgs: reg });
	} catch (e) {
		console.log(e);
		throw new Error(e);
	}
}

module.exports = { default: run };
