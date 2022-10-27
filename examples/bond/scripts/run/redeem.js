const { tokenMap, couponValue, redeemCouponTx, tryExecuteTx } = require("./common/common.js");

/**
 * Redeem old tokens, get coupon_value + new bond tokens
 * @param deployer deployer object
 * @param buyerAccount buyer account
 * @param managerAcc manager account
 * @param dex dex number from which you want to make a redemption
 * @param amount bond amount
 * For ex: 1 means your 0 bond-tokens will be redeemed from 1st Dex
 */
exports.redeem = async function (deployer, buyerAccount, managerAcc, dex, amount) {
	const appInfo = deployer.getApp("BondApp");
	const oldBond = tokenMap.get("bond-token-" + String(dex - 1));
	const newBond = tokenMap.get("bond-token-" + String(dex));
	const scInitParam = {
		TMPL_OLD_BOND: oldBond,
		TMPL_NEW_BOND: newBond,
		TMPL_APPLICATION_ID: appInfo.appID,
		TMPL_APP_MANAGER: managerAcc.addr,
	};
	const dexLsig = await deployer.loadLogicByFile("dex-lsig.py", scInitParam);
	await deployer.optInAccountToASA(newBond, buyerAccount.name, {}).catch((error) => {
		throw error;
	});
	const groupTx = redeemCouponTx(
		buyerAccount,
		dexLsig,
		amount,
		oldBond,
		newBond,
		couponValue,
		appInfo.appID
	);

	console.log(`* Redeeming ${amount} tokens for ${buyerAccount.name} from Dex: ${dex}!`);
	await tryExecuteTx(deployer, groupTx);
	console.log("Tokens redeemed!");
};
