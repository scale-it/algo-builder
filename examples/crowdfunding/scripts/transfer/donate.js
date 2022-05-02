const { convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const donorAccount = deployer.accountsByName.get("john");

	await deployer.executeTx({
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: donorAccount.addr,
		amountMicroAlgos: 20e6,
		payFlags: {},
	});

	// App argument to donate.
	const appArgs = [convert.stringToBytes("donate")];

	// Get AppInfo and AssetID from checkpoints.
	const appInfo = deployer.getApp("CrowdfundingApp");

	// Get Escrow Account Address
	const escrowAccount = deployer.getLsig("escrow");
	console.log("Escrow Address: ", escrowAccount.address());

	const txGroup = [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: donorAccount,
			appID: appInfo.appID,
			payFlags: {},
			appArgs: appArgs,
		},
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: donorAccount,
			toAccountAddr: escrowAccount.address(),
			amountMicroAlgos: 5000000,
			payFlags: {},
		},
	];

	console.log("Donation transaction in process");
	await deployer.executeTx(txGroup);
	console.log("Donated!");
}

module.exports = { default: run };
