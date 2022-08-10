/**
 * Description:
 * This script shows a basic ASA transfer functionality between 2 user accounts.
 */

const { balanceOf } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	// query gold ASA from deployer (using checkpoint information),
	const gold = deployer.asa.get("gold");
	if (gold === undefined) {
		console.error("Gold was not deployed. You must run `algob deploy` first.");
		return;
	}

	// query accounts from config
	const john = deployer.accountsByName.get("john");
	const goldOwner = deployer.accountsByName.get("alice");

	// execute asset transfer transaction
	await deployer.executeTx([
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: goldOwner,
			toAccountAddr: john.addr,
			amount: 1,
			assetID: gold.assetIndex,
			payFlags: { totalFee: 1000 },
		},
	]);

	console.log("Balance: ", await balanceOf(deployer, john.addr, gold.assetIndex));
}

module.exports = { default: run };
