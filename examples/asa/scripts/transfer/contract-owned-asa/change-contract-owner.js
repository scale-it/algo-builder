/**
 * Description:
 * This file demonstrates how to change owner of ASA owned by
 * smart contract account(stateless).
 */
const { convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { mkParam } = require("../common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const alice = deployer.accountsByName.get("alice");
	const bob = deployer.accountsByName.get("bob");

	await deployer.executeTx(mkParam(masterAccount, alice.addr, 5e6, { note: "Funding" }));

	// Get AppInfo from checkpoint.
	const appInfo = deployer.getApp("StatefulASA_App");

	// App argument to change_owner.
	const appArgs = [convert.stringToBytes("change_owner"), convert.addressToPk(bob.addr)];

	const tx = [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice,
			appID: appInfo.appID,
			payFlags: { totalFee: 1000 },
			appArgs: appArgs,
		},
	];

	await deployer.executeTx(tx);
}

module.exports = { default: run };
