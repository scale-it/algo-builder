/**
 * Description:
 * This file demonstrates the example to transfer contract owned ASA
 * from a contract account (lsig) to an owner account.
 * The logic assures that:
 *  + tx is asset transfer and amount is <= 100 and receiver is `alice`
 *  + fee is <= 1000
 *  + we don't do any rekey, closeRemainderTo
 */
const { types } = require("@algo-builder/web");
const { balanceOf } = require("@algo-builder/algob");
const { executeTx, mkParam } = require("../common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const alice = deployer.accountsByName.get("alice");
	const bob = deployer.accountsByName.get("bob");

	await deployer.executeTx(mkParam(masterAccount, alice.addr, 5e6, { note: "Funding" }));

	// Get AppInfo and AssetID from checkpoints.
	const appInfo = deployer.getApp("StatefulASA_App");
	const lsig = deployer.getLsig("StateLessASALsig");

	/* Transfer ASA 'gold' from contract account to user account */
	const assetID = deployer.asa.get("platinum").assetIndex;
	console.log("Asset Index: ", assetID);

	await deployer.optInAccountToASA("platinum", "alice", {});

	const txGroup = [
		// Stateful call
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice,
			appID: appInfo.appID,
			payFlags: { totalFee: 1000 },
		},
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: lsig.address(),
			toAccountAddr: alice.addr,
			amount: 20n,
			assetID: assetID,
			lsig: lsig,
			payFlags: { totalFee: 1000 },
		},
	];

	await deployer.executeTx(txGroup);
	// print assetHolding of alice
	console.log("Alice assetHolding balance: ", await balanceOf(deployer, alice.addr, assetID));

	try {
		// tx FAIL: trying to receive asset from another account
		txGroup[0].fromAccount = bob;
		await deployer.executeTx(txGroup);
	} catch (e) {
		console.error(e);
	}

	try {
		// tx FAIL: trying to send asset directly without calling stateful smart contract
		await deployer.executeTx([
			{
				type: types.TransactionType.TransferAsset,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: lsig.address(),
				toAccountAddr: alice.addr,
				amount: 20n,
				assetID: assetID,
				lsig: lsig,
				payFlags: { totalFee: 1000 },
			},
		]);
	} catch (e) {
		console.error(e);
	}
}

module.exports = { default: run };
