const { getProgram } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { assert } = require("chai");

const { createDexTx, redeemCouponTx } = require("../../scripts/run/common/common");

const bondToken = "bond-token-";
const asaDef = {
	total: 1000000,
	decimals: 0,
	defaultFrozen: false,
	unitName: "BOND",
	url: "url",
	metadataHash: "12312442142141241244444411111133",
	noteb64: "noteb64",
	manager: "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
	reserve: "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
	freeze: "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
};

function optInLsigToBond(runtime, lsig, assetID, appManager) {
	// Only store manager can allow opt-in to ASA for lsig
	const optInTx = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: appManager.account,
			toAccountAddr: lsig.address(),
			amountMicroAlgos: 0,
			payFlags: {},
		},
		{
			type: types.TransactionType.OptInASA,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: lsig.address(),
			lsig: lsig,
			assetID: assetID,
			payFlags: {},
		},
	];
	runtime.executeTx(optInTx);
}

const placeholderParam = {
	TMPL_NOMINAL_PRICE: 1000,
	TMPL_MATURITY_DATE: Math.round(new Date().getTime() / 1000) + 240,
};

const approvalProgramFilename = "bond-dapp-stateful.py";
const clearProgramFilename = "bond-dapp-clear.py";

const approvalProgram = getProgram(approvalProgramFilename, "", placeholderParam);
const clearProgram = getProgram(clearProgramFilename);

const minBalance = 10e6; // 10 ALGO's
const initialBalance = 200e6;
const coupon = 20;
const issue = 1000;

/**
 * Creates DEX_i lsig, burn B_i tokens, issue B_i+1 tokens
 * @param runtime runtime object
 * @param creatorAccount
 * @param managerAcc
 * @param i create ith dex
 * @param master
 * @param issuerLsig
 * i must be >= 1
 */
function createDex(runtime, creatorAccount, managerAcc, i, master, issuerLsig) {
	if (i < 1) {
		throw new Error("`i` must be greater than equal to 1");
	}

	const previousToken = bondToken + String(i - 1);
	const oldBond = runtime.getAssetInfoFromName(previousToken).assetIndex;
	const appInfo = runtime.getAppInfoFromName(approvalProgram, clearProgram);
	const newBondToken = bondToken + String(i);
	const getGlobal = (key) => runtime.getGlobalState(appInfo.appID, key);

	// Create B_[i+1]
	const newBond = runtime.deployASADef(newBondToken, asaDef, {
		creator: { ...creatorAccount.account, name: "bond-token-creator" },
	}).assetIndex;

	optInLsigToBond(runtime, issuerLsig, newBond, managerAcc);

	// Create dex
	const param = {
		TMPL_OLD_BOND: oldBond,
		TMPL_NEW_BOND: newBond,
		TMPL_APPLICATION_ID: appInfo.appID,
		TMPL_APP_MANAGER: managerAcc.address,
	};
	const dexLsig = runtime.loadLogic("dex-lsig.py", param);
	const dexLsigAddress = dexLsig.address();

	// fund dex with some minimum balance first
	const fundDexParam = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: master.account,
		toAccountAddr: dexLsigAddress,
		amountMicroAlgos: minBalance + 10000,
		payFlags: {},
	};
	runtime.executeTx([fundDexParam]);

	optInLsigToBond(runtime, dexLsig, oldBond, managerAcc);
	optInLsigToBond(runtime, dexLsig, newBond, managerAcc);

	const total = getGlobal("total");
	const assetAmount = runtime.getAccount(issuerLsig.address()).getAssetHolding(oldBond)?.amount;
	const groupTx = createDexTx(
		managerAcc.account,
		appInfo.appID,
		issuerLsig,
		dexLsig,
		creatorAccount.account,
		assetAmount,
		newBond,
		oldBond,
		total,
		coupon
	);

	runtime.executeTx(groupTx);

	const issuer = runtime.getAccount(issuerLsig.address());
	assert.equal(
		runtime.getAccount(dexLsig.address()).getAssetHolding(newBond)?.amount,
		BigInt(total)
	);
	assert.equal(issuer.getAssetHolding(oldBond)?.amount, 0n);
	assert.equal(issuer.getAssetHolding(newBond)?.amount, BigInt(assetAmount));

	return dexLsig;
}

/**
 * Redeem old tokens, get coupon_value (reward) + new bond tokens
 * @param runtime runtime object
 * @param buyerAccount buyer account
 * @param managerAcc manager account
 * @param dex dex number from which you want to make a redemption
 * @param amount bond amount
 * For ex: 1 means your 0 bond-tokens will be redeemed from 1st Dex
 */
function redeem(runtime, buyerAccount, dex, amount, dexLsig) {
	const appInfo = runtime.getAppInfoFromName(approvalProgram, clearProgram);
	const oldBond = runtime.getAssetInfoFromName(bondToken + String(dex - 1)).assetIndex;
	const newBond = runtime.getAssetInfoFromName(bondToken + String(dex)).assetIndex;
	const initBond = buyerAccount.getAssetHolding(oldBond)?.amount;

	runtime.optInToASA(newBond, buyerAccount.address, {});

	const balanceBeforeRedeem = buyerAccount.balance();
	const groupTx = redeemCouponTx(
		buyerAccount.account,
		dexLsig,
		amount,
		oldBond,
		newBond,
		coupon,
		appInfo.appID
	);

	runtime.executeTx(groupTx);

	buyerAccount = runtime.getAccount(buyerAccount.address);
	assert.equal(
		buyerAccount.getAssetHolding(oldBond)?.amount,
		BigInt(initBond) - BigInt(amount)
	);
	assert.equal(buyerAccount.getAssetHolding(newBond)?.amount, BigInt(amount));
	assert.equal(
		balanceBeforeRedeem + BigInt(amount) * BigInt(coupon) - 4000n,
		buyerAccount.balance()
	);
}

module.exports = {
	optInLsigToBond,
	createDex,
	placeholderParam,
	approvalProgram,
	clearProgram,
	minBalance,
	initialBalance,
	coupon,
	issue,
	redeem,
};
