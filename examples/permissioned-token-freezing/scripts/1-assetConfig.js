const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const creator = deployer.accountsByName.get("alice");

	// NOTE: make sure to deploy 0-createAppAsset.js first
	const appInfo = deployer.getApp("PermissionedTokenApp");
	const assetInfo = deployer.asa.get("gold");

	/** * Compile and fund escrow***/
	const escrowParams = {
		ASSET_ID: assetInfo.assetIndex,
		APP_ID: appInfo.appID,
	};
	await deployer.mkContractLsig("clawbackEscrow", "clawback-escrow.py", escrowParams);

	await deployer.fundLsig("clawbackEscrow", { funder: creator, fundingMicroAlgo: 1e6 }, {}); // sending 1 Algo

	const escrowLsig = deployer.getLsig("clawbackEscrow");
	const escrowAddress = escrowLsig.address();

	/** Update clawback address to escrow **/
	console.log("* Updating asset clawback to escrow *");
	const assetConfigParams = {
		type: types.TransactionType.ModifyAsset,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		assetID: assetInfo.assetIndex,
		fields: { clawback: escrowAddress }, // only pass the field you want to update
		payFlags: { totalFee: 1000 },
	};
	await deployer.executeTx([assetConfigParams]);

	/** now lock the asset by clearing the manager and freeze account **/
	console.log("* Locking the manager and freeze address *");
	const assetLockParams = {
		...assetConfigParams,
		fields: { manager: "", freeze: "" },
	};
	await deployer.executeTx([assetLockParams]);
}

module.exports = { default: run };
