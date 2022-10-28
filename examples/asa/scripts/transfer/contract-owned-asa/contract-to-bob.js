/**
 * Description:
 * This file demonstrates the example to transfer contract owned ASA
 * from a contract account (lsig) to an changed owner account.
 * Note: This transfer will only work if owner is changed to bob
 */
const { types } = require("@algo-builder/web");
const { balanceOf } = require("@algo-builder/algob");
const { tryExecuteTx, mkParam } = require("../common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const alice = deployer.accountsByName.get("alice");
	const bob = deployer.accountsByName.get("bob");

	await tryExecuteTx(deployer, mkParam(masterAccount, bob.addr, 5e6, { note: "Funding" }));
	// Get AppInfo and AssetID from checkpoints.
	const appInfo = deployer.getApp("StatefulASA_App");
	const lsig = deployer.getLsig("StatelessASALsig");

	/* Transfer ASA 'gold' from contract account to user account */
	const assetID = deployer.asa.get("platinum").assetIndex;
	console.log("Asset Index: ", assetID);
	await deployer.optInAccountToASA("platinum", "bob", {});

	const txGroup = [
		// Stateful call
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: bob,
			appID: appInfo.appID,
			payFlags: { totalFee: 1000 },
		},
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: lsig.address(),
			toAccountAddr: bob.addr,
			amount: 20n,
			assetID: assetID,
			lsig: lsig,
			payFlags: { totalFee: 1000 },
		},
	];

	await tryExecuteTx(deployer, txGroup);
	// print assetHolding of alice
	console.log("Alice assetHolding balance: ", await balanceOf(deployer, alice.addr, assetID));

	try {
		// tx FAIL: trying to receive asset from initial owner account
		txGroup[0].fromAccount = alice;
		await tryExecuteTx(deployer, txGroup);
	} catch (e) {
		console.error(e);
	}
}

module.exports = { default: run };
