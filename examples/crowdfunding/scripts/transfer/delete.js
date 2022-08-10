const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const creatorAccount = deployer.accountsByName.get("alice");

	await deployer.executeTx({
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: creatorAccount.addr,
		amountMicroAlgos: 5e6,
		payFlags: {},
	});

	const appInfo = deployer.getApp("CrowdfundingApp");
	const lsig = deployer.getLsig("escrow");
	const escrowAccountAddress = lsig.address();

	// Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
	const txGroup = [
		{
			type: types.TransactionType.DeleteApp,
			sign: types.SignType.SecretKey,
			fromAccount: creatorAccount,
			appID: appInfo.appID,
			payFlags: {},
			appArgs: [],
			accounts: [escrowAccountAddress], //  AppAccounts
		},
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: escrowAccountAddress,
			toAccountAddr: creatorAccount.addr,
			amountMicroAlgos: 0,
			lsig: lsig,
			payFlags: { closeRemainderTo: creatorAccount.addr },
		},
	];

	console.log("Deleting Application transaction in process");
	await deployer.executeTx(txGroup);
	console.log("Application Deleted and Fund transferred to creator account");
}

module.exports = { default: run };
