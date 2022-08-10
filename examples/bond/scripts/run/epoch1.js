const { accounts } = require("./common/accounts.js");
const { issuePrice, tokenMap, buyTxNode } = require("./common/common.js");
const { redeem } = require("./redeem.js");

/**
 * In this function Elon redeems his 8 bonds, and
 * Elon buys 4 more bonds (so he will have 12 bonds in total)
 * @param deployer deployer object
 */
exports.epoch1 = async function (deployer) {
	const account = await accounts(deployer);

	// Redeem 8 bonds
	await redeem(deployer, account.elon, account.manager, 1, 8);
	console.log("Elon redeemed 8 bonds from dex_1");

	const appInfo = deployer.getApp("BondApp");
	const issuerLsig = deployer.getLsig("IssuerLsig");
	const bondToken = tokenMap.get("bond-token-1");
	await deployer.optInAccountToASA(bondToken, "bob", { totalFee: 1000 });
	await deployer.optInAccountToASA(bondToken, "elon-musk", { totalFee: 1000 });

	// elon buys 4 bonds
	const algoAmount = 4 * issuePrice;

	const groupTx = await buyTxNode(
		deployer,
		account.elon,
		issuerLsig,
		algoAmount,
		appInfo.appID,
		bondToken
	);

	console.log("Elon buying 4 more bonds!");
	await deployer.executeTx(groupTx);
	console.log("Elon bought 4 more bonds!");
};
