const { convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { tryExecuteTx } = require("../common/common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const donorAccount = deployer.accountsByName.get("john");

	await tryExecuteTx(deployer, {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: donorAccount.addr,
		amountMicroAlgos: 5000000,
		payFlags: {},
	});

	// App argument to claim.
	const appArgs = [convert.stringToBytes("reclaim")];

	// Get AppInfo and AssetID from checkpoints.
	const appInfo = deployer.getApp("CrowdfundingApp");

	// Get Escrow Account Address
	const lsig = deployer.getLsig("escrow");
	const escrowAccountAddress = lsig.address();

	const txGroup = [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: donorAccount,
			appID: appInfo.appID,
			payFlags: {},
			appArgs: appArgs,
			accounts: [escrowAccountAddress], //  AppAccounts
		},
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: escrowAccountAddress,
			toAccountAddr: donorAccount.addr,
			amountMicroAlgos: 50000, // This amount should be (amount donated - fee)
			lsig: lsig,
			payFlags: {},
		},
	];

	console.log("Reclaim transaction in process");
	await tryExecuteTx(deployer, txGroup);
	console.log("Reclaimed by ", donorAccount.addr);
}

module.exports = { default: run };
