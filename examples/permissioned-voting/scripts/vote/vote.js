const { types } = require("@algo-builder/web");
const { convert } = require("@algo-builder/algob");
const { executeTx } = require("./common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const alice = deployer.accountsByName.get("alice");
	const votingAdminAccount = deployer.accountsByName.get("john");
	const bob = deployer.accountsByName.get("bob");

	await deployer.executeTx({
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: alice.addr,
		amountMicroAlgos: 200000000,
		payFlags: {},
	});
	await deployer.executeTx({
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: bob.addr,
		amountMicroAlgos: 200000000,
		payFlags: {},
	});

	// Get last round.
	const status = await deployer.algodClient.status().do();
	console.log("Last Round: ", status["last-round"]);

	// App arguments to vote for "candidatea".
	const appArgs = [convert.stringToBytes("vote"), convert.stringToBytes("candidatea")];

	// Get AppInfo and AssetID from checkpoints.
	const appInfo = deployer.getApp("PermissionedVotingApp");
	const voteAssetID = deployer.asa.get("vote-token").assetIndex;

	// Atomic Transaction (Stateful Smart Contract call + Asset Transfer)
	const transactions = [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice,
			appID: appInfo.appID,
			payFlags: {},
			appArgs,
		},
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: alice,
			toAccountAddr: votingAdminAccount.addr,
			amount: 1,
			assetID: voteAssetID,
			payFlags: {},
		},
	];

	// Transaction Passes because Alice is registered voter and hasn't voted yet.
	console.log("Vote being casted by Alice");
	await deployer.executeTx(transactions);

	// Transaction Fails because Alice can only vote once.
	console.log("Alice tries to cast vote again");
	await deployer.executeTx(transactions);

	// Transaction Fails because bob is not registered voter.
	console.log("Bob tries to cast vote");
	transactions[0].fromAccount = bob;
	transactions[1].fromAccount = bob;

	await deployer.executeTx(transactions);
}

module.exports = { default: run };
