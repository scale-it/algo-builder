const { types } = require("@algo-builder/web");
const { tokenMap, nominalPrice, tryExecuteTx } = require("./common/common");

/**
 * In this function buyer exits from all their bonds in exchange of algos
 * @param deployer deployer object
 * @param managerAcc manager account
 * @param buyerAccount buyer account
 * @param n nth bond
 * @param amount amount of bond tokens
 */
exports.exitBuyer = async function (deployer, managerAcc, buyerAccount, n, amount) {
	const appInfo = deployer.getApp("BondApp");
	const bondToken = tokenMap.get("bond-token-" + String(n));
	const scInitParam = {
		TMPL_APPLICATION_ID: appInfo.appID,
		TMPL_APP_MANAGER: managerAcc.addr,
		TMPL_BOND: bondToken,
	};
	const buybackLsig = await deployer.loadLogicByFile("buyback-lsig.py", scInitParam);

	const exitAmount = Number(amount) * Number(nominalPrice);
	const exitTx = [
		//  Bond token transfer to buyback address
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: buyerAccount,
			toAccountAddr: buybackLsig.address(),
			amount: amount,
			assetID: bondToken,
			payFlags: { totalFee: 2000 },
		},
		// Nominal price * amount paid to buyer
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: buybackLsig.address(),
			lsig: buybackLsig,
			toAccountAddr: buyerAccount.addr,
			amountMicroAlgos: exitAmount,
			payFlags: { totalFee: 0 },
		},
		// call to bond-dapp
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: buyerAccount,
			appID: appInfo.appID,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:exit"],
		},
	];

	console.log("Exiting");
	await tryExecuteTx(deployer, exitTx);
	console.log("Exited");
};
