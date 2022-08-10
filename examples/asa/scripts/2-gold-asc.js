const { balanceOf, signTransactions } = require("@algo-builder/algob");
const { types, getSuggestedParams } = require("@algo-builder/web");
const { mkParam } = require("./transfer/common");
const { makeAssetTransferTxnWithSuggestedParams } = require("algosdk");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const goldOwner = deployer.accountsByName.get("alice");

	await deployer.executeTx(
		mkParam(masterAccount, goldOwner.addr, 200e6, { note: "funding account" })
	);

	// save Smart Signature by name & fund the account
	const ascInfoContract = await deployer.mkContractLsig(
		"Gold_C_Lsig",
		"2-gold-contract-asc.teal",
		{}
	);
	console.log(ascInfoContract);
	await deployer.fundLsig("Gold_C_Lsig", { funder: goldOwner, fundingMicroAlgo: 1e6 }, {}); // funding with 1 Algo

	const ascInfoAlgoDelegated = await deployer.mkDelegatedLsig(
		"Gold_D_Lsig",
		"3-gold-delegated-asc.teal",
		goldOwner
	);
	const ascInfoGoldDelegated = await deployer.mkDelegatedLsig(
		"Gold_d_asa_lsig",
		"4-gold-asa.teal",
		goldOwner
	);

	console.log(ascInfoAlgoDelegated);
	console.log(ascInfoGoldDelegated);

	/* Contract opt-in for ASA gold + fund contract with ASA gold */
	const lsig = await deployer.getLsig("Gold_C_Lsig");
	const goldAsset = deployer.asa.get("gold");
	const goldAssetID = goldAsset.assetIndex;
	await deployer.optInLsigToASA(goldAssetID, lsig, { totalFee: 1000 });
	console.log("Balance: ", await balanceOf(deployer, lsig.address(), goldAssetID));

	console.log(`Funding contract ${lsig.address()} with ASA gold`);
	const tx = makeAssetTransferTxnWithSuggestedParams(
		goldOwner.addr,
		lsig.address(),
		undefined,
		undefined,
		1e5,
		undefined,
		goldAssetID,
		await getSuggestedParams(deployer.algodClient)
	);
	const sign = {
		sign: types.SignType.SecretKey,
		fromAccount: goldOwner,
	};

	await deployer.executeTx([{ transaction: tx, sign: sign }]);
	await balanceOf(deployer, lsig.address(), goldAssetID);

	// To get raw signed transaction you may use `signTransactions` function
	const _rawSign = signTransactions([{ transaction: tx, sign: sign }]);
}

module.exports = { default: run };
