const { types } = require("@algo-builder/web");
const { accounts } = require("./common/accounts.js");
const { issuePrice, buyTxNode, tryExecuteTx } = require("./common/common.js");

/**
 * In this function: Elon buys 10 bonds and
 * Elon sells 2 bonds to bob for 2020 ALGO (in a group transaction)
 * @param deployer deployer object
 */
exports.epoch0 = async function (deployer) {
	const account = await accounts(deployer);
	const appInfo = deployer.getApp("BondApp");
	const issuerLsig = deployer.getLsig("IssuerLsig");
	const asaInfo = deployer.getASAInfo("bond-token-0");
	await deployer
		.optInAccountToASA(asaInfo.assetIndex, "bob", { totalFee: 1000 })
		.catch((error) => {
			throw error;
		});
	await deployer
		.optInAccountToASA(asaInfo.assetIndex, "elon-musk", { totalFee: 1000 })
		.catch((error) => {
			throw error;
		});

	// elon buys 10 bonds
	const algoAmount = 10 * issuePrice;

	const groupTx = await buyTxNode(
		deployer,
		account.elon,
		issuerLsig,
		algoAmount,
		appInfo.appID,
		asaInfo.assetIndex
	);

	console.log("Elon buying 10 bonds!");
	await tryExecuteTx(deployer, groupTx);
	console.log("Elon bought 10 bonds!");

	// elon sells 2 bonds to bob for 2020 Algo
	const sellTx = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: account.bob,
			toAccountAddr: account.elon.addr,
			amountMicroAlgos: 2020,
			payFlags: { totalFee: 1000 },
		},
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: account.elon,
			toAccountAddr: account.bob.addr,
			amount: 2,
			assetID: asaInfo.assetIndex,
			payFlags: { totalFee: 1000 },
		},
	];
	await tryExecuteTx(deployer, sellTx);
	console.log("2 bonds sold to bob from elon!");
};
