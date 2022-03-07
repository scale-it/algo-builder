/**
 * In this script we will try to debug a transaction group composed as:
 * (stateful application call + stateless tx + transfer algo)
 */
const { Tealdbg } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const creator = deployer.accountsByName.get("alice");
	const bob = deployer.accountsByName.get("bob");

	// NOTE: set min asset level first using ./set-clear-level.js
	const appInfo = deployer.getApp("PermissionedTokenApp");
	const assetInfo = deployer.asa.get("gold");

	const escrowParams = {
		ASSET_ID: assetInfo.assetIndex,
		APP_ID: appInfo.appID,
	};
	const escrowLsig = deployer.getLsig("clawbackEscrow");
	const escrowAddress = escrowLsig.address();

	const txGroup = [
		// NOTE: tx0 will fail if an account level is below level or not set
		// (i.e script ./set-clear-level.js is not executed)
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: creator,
			appID: appInfo.appID,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:check-level"],
			accounts: [bob.addr], //  AppAccounts
		},
		{
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: escrowAddress,
			recipient: bob.addr,
			assetID: assetInfo.assetIndex,
			revocationTarget: creator.addr,
			amount: 1000,
			lsig: escrowLsig,
			payFlags: { totalFee: 1000 },
		},
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: creator,
			toAccountAddr: escrowAddress,
			amountMicroAlgos: 1000,
			payFlags: { totalFee: 1000 },
		},
	];

	console.log("* Debug ./transfer-asset.js: Transferring 1000 Assets from Alice to Bob *");

	const debug = new Tealdbg(deployer, txGroup);
	await debug.dryRunResponse("dryrun.json"); // tx0 message will be "REJECT" if ./set-clear-level.js is not executed (min level is not set)

	// debug 1st transaction (checking min-level of an account is set)
	// await debug.run({ tealFile: "poi-approval.teal", groupIndex: 0 });

	/* debug 2nd transaction (transfer asset using clawbackLsig)
	 * uncomment below code after commenting line 61 */
	await debug.run({
		tealFile: "clawback-escrow.py",
		scInitParam: escrowParams,
		groupIndex: 1,
	});
}

module.exports = { default: run };
