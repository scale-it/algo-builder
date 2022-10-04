const { convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { optInTx, tryExecuteTx } = require("./run/common/common.js");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const managerAcc = deployer.accountsByName.get("alice");
	const creatorAccount = deployer.accountsByName.get("john");

	const algoTxnParams = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: masterAccount,
			toAccountAddr: managerAcc,
			amountMicroAlgos: 10e6,
			payFlags: {},
		},
	];
	await tryExecuteTx(deployer, algoTxnParams);
	algoTxnParams[0].toAccountAddr = creatorAccount.addr;
	await tryExecuteTx(deployer, algoTxnParams);

	// Create B_0 - Bond Token
	const asaInfo = await deployer
		.deployASA("bond-token-0", { creator: creatorAccount })
		.catch((error) => {
			throw error;
		});
	console.log(asaInfo);

	// Bond-Dapp initialization parameters
	const appManager = convert.addressToPk(managerAcc.addr);
	const issuePrice = "int:1000";
	const couponValue = "int:20";
	const currentBond = convert.uint64ToBigEndian(asaInfo.assetIndex);
	const asset = await deployer.getAssetByID(asaInfo.assetIndex).catch((error) => {
		throw error;
	});
	const maxIssuance = convert.uint64ToBigEndian(asset.params.total);
	const creator = convert.addressToPk(creatorAccount.addr);

	let appArgs = [appManager, creator, issuePrice, couponValue, currentBond, maxIssuance];
	const placeholderParam = {
		TMPL_NOMINAL_PRICE: 1000,
		TMPL_MATURITY_DATE: Math.round(new Date().getTime() / 1000) + 240,
	};
	// Create Application
	const bondAppInfo = await deployer
		.deployApp(
			managerAcc,
			{
				appName: "BondApp",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "bond-dapp-stateful.py",
				clearProgramFilename: "bond-dapp-clear.py",
				localInts: 1,
				localBytes: 1,
				globalInts: 8,
				globalBytes: 15,
				appArgs: appArgs,
			},
			{},
			placeholderParam
		)
		.catch((error) => {
			throw error;
		});
	console.log(bondAppInfo);

	// Initialize issuer lsig with bond-app ID
	const scInitParam = {
		TMPL_APPLICATION_ID: bondAppInfo.appID,
		TMPL_OWNER: creatorAccount.addr,
		TMPL_APP_MANAGER: managerAcc.addr,
	};

	await deployer.mkContractLsig("IssuerLsig", "issuer-lsig.py", scInitParam).catch((error) => {
		throw error;
	});
	const issuerLsig = deployer.getLsig("IssuerLsig");

	algoTxnParams[0].toAccountAddr = issuerLsig.address();
	await tryExecuteTx(deployer, algoTxnParams);

	// Only app manager can opt-in issueer lsig to ASA
	await optInTx(deployer, managerAcc, issuerLsig, asaInfo.assetIndex);

	// update issuer address in bond-dapp
	appArgs = ["str:update_issuer_address", convert.addressToPk(issuerLsig.address())];

	const appCallParams = [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: managerAcc,
			appID: bondAppInfo.appID,
			payFlags: {},
			appArgs: appArgs,
		},
	];
	await tryExecuteTx(deployer, appCallParams);

	console.log("Issuer address updated!");
}

module.exports = { default: run };
