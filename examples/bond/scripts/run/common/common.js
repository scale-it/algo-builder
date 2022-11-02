const { readAppGlobalState } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { accounts } = require("./accounts");

const issuePrice = 1000;
const couponValue = 20;
const nominalPrice = 1000;

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

const tokenMap = new Map();

/**
 * Execute single transaction or group of transactions (atomic transaction)
 * @param deployer deployer instance
 * @param transactions transaction parameters,  atomic transaction parameters
 * @returns TxnReceipt which includes confirmed txn response along with txID
 */
async function tryExecuteTx(deployer, txnParams) {
	try {
		const txnParameters = Array.isArray(txnParams) ? txnParams : [txnParams];
		return await deployer.executeTx(txnParameters);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
		throw e;
	}
}

/**
 * returns asset id for a given asset name
 * @param name asset name
 */
async function getAssetID(name, deployer) {
	const asaInfo = await deployer.getASAInfo(name);
	return asaInfo.assetIndex;
}

// fund account using master account
async function fundAccount(deployer, accountAddress) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const algoTxnParams = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: accountAddress,
		amountMicroAlgos: 200e6,
		payFlags: {},
	};
	await tryExecuteTx(deployer, algoTxnParams);
}

/**
 * Returns Opt-In lsigs to a given asa transaction
 * Note: only manager is allowed to opt-in lsigs to asa
 * This is because, no other user can spam asa opt-in in lsigs
 * @param deployer deployer object
 * @param managerAcc manager account
 * @param lsig logic signature
 * @param assetIndex asset index
 */
async function optInTx(deployer, managerAcc, lsig, assetIndex) {
	const optInTx = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: managerAcc,
			toAccountAddr: lsig.address(),
			amountMicroAlgos: 0,
			payFlags: {},
		},
		{
			type: types.TransactionType.OptInASA,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: lsig.address(),
			lsig: lsig,
			assetID: assetIndex,
			payFlags: {},
		},
	];
	await tryExecuteTx(deployer, optInTx);
}

/**
 * Creates a group transaction for buying bond tokens.
 * @param buyer buyer account
 * @param issuerLsig Bond issuer logic signature
 * @param amount amount of bonds
 * @param algoAmount amount of Algo to pay for the bonds
 * @param appID Bond application index
 * @param bondID Bond ASA index
 */
function buyTx(buyer, issuerLsig, amount, algoAmount, appID, bondID) {
	return [
		// Algo transfer from buyer to issuer
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: buyer,
			toAccountAddr: issuerLsig.address(),
			amountMicroAlgos: algoAmount,
			payFlags: { totalFee: 2000 },
		},
		// Bond token transfer from issuer's address
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: issuerLsig.address(),
			lsig: issuerLsig,
			toAccountAddr: buyer.addr,
			amount: amount,
			assetID: bondID,
			payFlags: { totalFee: 0 },
		},
		// call to bond-dapp
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: buyer,
			appID: appID,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:buy"],
		},
	];
}

/**
 * Returns buy transaction using algorand node
 * @param deployer deployer object
 * @param buyer buyer account
 * @param issuerLsig Bond issuer logic signature
 * @param algoAmount amount of Algo to pay for the bonds
 * @param appID Bond application index
 * @param bondID Bond ASA index
 */
async function buyTxNode(deployer, buyer, issuerLsig, algoAmount, appID, bondID) {
	const account = await accounts(deployer);
	const globalState = await readAppGlobalState(deployer, account.manager.addr, appID);
	const bondPrice = globalState.get("issue_price");
	return buyTx(buyer, issuerLsig, algoAmount / bondPrice, algoAmount, appID, bondID);
}

/**
 * Returns buy transaction for test/runtime
 * @param runtime runtime object
 * @param buyer buyer account
 * @param issuerLsig Bond issuer logic signature
 * @param algoAmount amount of Algo to pay for the bonds
 * @param appID Bond application index
 * @param bondID Bond ASA index
 */
function buyTxRuntime(runtime, buyer, issuerLsig, algoAmount, appID, bondID) {
	const bondPrice = Number(runtime.getGlobalState(appID, "issue_price"));
	return buyTx(buyer, issuerLsig, algoAmount / bondPrice, algoAmount, appID, bondID);
}

/**
 * Returns issue group transaction
 * @param creatorAccount creator acccount
 * @param issuerLsig Bond issuer logic signature
 * @param appID Bond application index
 * @param bondID Bond ASA index
 */
function issueTx(creatorAccount, issuerLsig, appID, bondID) {
	return [
		// Bond asa transfer to issuer's address
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: creatorAccount,
			toAccountAddr: issuerLsig.address(),
			amount: 1e6,
			assetID: bondID,
			payFlags: {},
		},
		// call to bond-dapp
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: creatorAccount,
			appID: appID,
			payFlags: {},
			appArgs: ["str:issue"],
		},
	];
}

/**
 * Returns create dex transaction
 * @param managerAccount App manager account
 * @param appID Bond application index
 * @param issuerLsig Bond issuer logic signature
 * @param dexLsig Bond dex logic signature
 * @param creatorAccount Bond ASA creator account
 * @param unsoldBonds balance of oldBond tokens hold by the issuer (amount of unsold bonds)
 * @param newBondID new bond ASA index
 * @param oldBondID old bond ASA index
 * @param total total number of bonds issued to buyers
 * @param couponValue value of coupon
 */
function createDexTx(
	managerAccount,
	appID,
	issuerLsig,
	dexLsig,
	creatorAccount,
	unsoldBonds,
	newBondID,
	oldBondID,
	total,
	couponValue
) {
	return [
		// call to bond-dapp
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: managerAccount,
			appID: appID,
			payFlags: {},
			appArgs: ["str:create_dex"],
			accounts: [issuerLsig.address(), dexLsig.address()],
			foreignAssets: [oldBondID],
		},
		// New bond token transfer to issuer's address
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: creatorAccount,
			toAccountAddr: issuerLsig.address(),
			amount: unsoldBonds,
			assetID: newBondID,
			payFlags: { totalFee: 1000 },
		},
		// burn tokens
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: issuerLsig.address(),
			lsig: issuerLsig,
			toAccountAddr: creatorAccount.addr,
			amount: unsoldBonds,
			assetID: oldBondID,
			payFlags: { totalFee: 1000 },
		},
		// Transfer app.total amount of new Bonds to dex lsig
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: creatorAccount,
			toAccountAddr: dexLsig.address(),
			amount: total,
			assetID: newBondID,
			payFlags: { totalFee: 1000 },
		},
		// Algo transfer to dex address
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: creatorAccount,
			toAccountAddr: dexLsig.address(),
			amountMicroAlgos: Number(total) * Number(couponValue),
			payFlags: { totalFee: 1000 },
		},
	];
}

/**
 * Returns redeem transaction
 * @param buyerAccount buyer account
 * @param dexLsig Bond dex logic signature
 * @param amount amount of bonds to be redeemed
 * @param oldBondID old bond token index
 * @param newBondID new bond token index
 * @param couponValue value of coupon
 * @param appID Bond application index
 */
function redeemCouponTx(
	buyerAccount,
	dexLsig,
	amount,
	oldBondID,
	newBondID,
	couponValue,
	appID
) {
	return [
		// Transfer tokens to dex lsig.
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: buyerAccount,
			toAccountAddr: dexLsig.address(),
			amount: amount,
			assetID: oldBondID,
			payFlags: { totalFee: 3000 },
		},
		// New bond token transfer to buyer's address
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: dexLsig.address(),
			lsig: dexLsig,
			toAccountAddr: buyerAccount.addr,
			amount: amount,
			assetID: newBondID,
			payFlags: { totalFee: 0 },
		},
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: dexLsig.address(),
			lsig: dexLsig,
			toAccountAddr: buyerAccount.addr,
			amountMicroAlgos: Number(amount) * Number(couponValue),
			payFlags: { totalFee: 0 },
		},
		// call to bond-dapp
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: buyerAccount,
			appID: appID,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:redeem_coupon"],
		},
	];
}

module.exports = {
	issuePrice,
	asaDef,
	fundAccount,
	getAssetID,
	tokenMap,
	couponValue,
	optInTx,
	nominalPrice,
	buyTx,
	issueTx,
	createDexTx,
	redeemCouponTx,
	buyTxNode,
	buyTxRuntime,
	tryExecuteTx,
};
