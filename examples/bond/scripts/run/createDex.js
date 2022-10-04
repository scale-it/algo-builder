const { readAppGlobalState, balanceOf } = require("@algo-builder/algob");
const {
	asaDef,
	fundAccount,
	tokenMap,
	optInTx,
	couponValue,
	createDexTx,
	tryExecuteTx,
} = require("./common/common.js");
const { types } = require("@algo-builder/web");

/**
 * This function creates DEX_i lsig, burn B_i tokens, issue B_i+1 tokens.
 * where i is the ith bond, only app manager is allowed to do this operation
 * @param  masterAccount
 * @param  creatorAccount
 * @param managerAcc
 * @param i create ith dex
 * i must be >= 1
 */
exports.createDex = async function (deployer, creatorAccount, managerAcc, i) {
	if (i < 1) {
		throw new Error("i must be greater than equal to 1");
	}
	const previousToken = "bond-token-" + String(i - 1);
	const oldBond = tokenMap.get(previousToken);
	const appInfo = deployer.getApp("BondApp");
	const issuerLsig = deployer.getLsig("IssuerLsig");
	console.log("Issuer address: ", issuerLsig.address());
	const newBondToken = "bond-token-" + String(i);
	const deployTx = [
		{
			type: types.TransactionType.DeployASA,
			sign: types.SignType.SecretKey,
			fromAccount: creatorAccount,
			asaName: newBondToken,
			asaDef: asaDef,
			payFlags: {},
		},
	];
	// Create B_[i+1]
	const newAsaInfo = (await tryExecuteTx(deployer, deployTx))[0];
	console.log(newAsaInfo);
	const newIndex = newAsaInfo["asset-index"];
	tokenMap.set(newBondToken, newIndex);

	// move to commmon
	// Only store manager can allow opt-in to ASA for lsig
	await optInTx(deployer, managerAcc, issuerLsig, newIndex);

	const lsigParams = {
		TMPL_OLD_BOND: oldBond,
		TMPL_NEW_BOND: newIndex,
		TMPL_APPLICATION_ID: appInfo.appID,
		TMPL_APP_MANAGER: managerAcc.addr,
	};
	const dexLsig = await deployer.loadLogicByFile("dex-lsig.py", lsigParams).catch((error) => {
		throw error;
	});

	await fundAccount(deployer, dexLsig.address());

	await optInTx(deployer, managerAcc, dexLsig, newIndex);
	await optInTx(deployer, managerAcc, dexLsig, oldBond);

	const globalState = await readAppGlobalState(deployer, managerAcc.addr, appInfo.appID).catch(
		(error) => {
			throw error;
		}
	);
	const total = globalState.get("total") ?? 0;
	console.log("Total issued: ", total);

	// balance of old bond tokens in issuer lsig
	const amount = await balanceOf(deployer, issuerLsig.address(), oldBond);
	console.log("Old balance amount ", amount);
	const groupTx = createDexTx(
		managerAcc,
		appInfo.appID,
		issuerLsig,
		dexLsig,
		creatorAccount,
		amount,
		newIndex,
		oldBond,
		total,
		couponValue
	);

	console.log(`* Creating dex ${i}! *`);
	await tryExecuteTx(deployer, groupTx);
	console.log("Dex created!");
	return newIndex;
};
