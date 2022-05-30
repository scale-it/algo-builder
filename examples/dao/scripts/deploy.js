const { types } = require("@algo-builder/web");
const { fundAccount, tryExecuteTx } = require("./run/common/common.js");

const { accounts } = require("./run/common/accounts");
const { getApplicationAddress } = require("algosdk");

async function run(runtimeEnv, deployer) {
	const { creator, proposer, voterA, voterB } = accounts(deployer);

	// fund accounts
	await fundAccount(deployer, [creator, proposer, voterA, voterB]);

	// Create DAO Gov Token
	const govToken = await deployer.deployASA("gov-token", { creator: creator });
	console.log(govToken);

	// DAO App initialization parameters
	const deposit = 15; // deposit required to make a proposal
	const minSupport = 5; // minimum number of yes power votes to validate proposal
	const minDuration = 1 * 60; // 1min (minimum voting time in number of seconds)
	const maxDuration = 5 * 60; // 5min (maximum voting time in number of seconds)
	const url = "www.my-url.com";
	const daoName = "DAO";
	const govTokenId = 99;

	const appArgs = [
		`int:${deposit}`,
		`int:${minSupport}`,
		`int:${minDuration}`,
		`int:${maxDuration}`,
		`str:${url}`,
		`str:${daoName}`,
		`int:${govTokenId}`,
	];
	// const templateParam = { ARG_GOV_TOKEN: govToken.assetIndex };
	// Create Application
	const daoAppInfo = await deployer.deployApp(
		creator,
		{
			appName: "DAOApp",
			metaType: types.MetaType.FILE,
			approvalProgramFilename: "dao-app-approval.py",
			clearProgramFilename: "dao-app-clear.py",
			localInts: 9,
			localBytes: 7,
			globalInts: 5,
			globalBytes: 2,
			appArgs: appArgs,
		},
		{}
	);
	console.log("after deployment", daoAppInfo);

	// Fund application account with some ALGO(5)
	const fundAppParameters = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		toAccountAddr: getApplicationAddress(daoAppInfo.appID),
		amountMicroAlgos: 15e6,
		payFlags: { totalFee: 1000 },
	};

	console.log(`Funding DAO App (ID = ${daoAppInfo.appID})`);
	await tryExecuteTx(deployer, fundAppParameters);

	// opt in deposit account (dao app account) to gov_token asa
	const optInToGovASAParam = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		appID: daoAppInfo.appID,
		payFlags: { totalFee: 2000 },
		foreignAssets: [govToken.assetIndex],
		appArgs: ["str:optin_gov_token"],
	};
	await tryExecuteTx(deployer, optInToGovASAParam);

	// save lsig's (by name in checkpoint)
	await deployer.mkContractLsig("daoFundLsig", "dao-fund-lsig.py", {
		ARG_GOV_TOKEN: govToken.assetIndex,
		ARG_DAO_APP_ID: daoAppInfo.appID,
	});

	await deployer.mkContractLsig("proposalLsig", "proposal-lsig.py", {
		ARG_OWNER: proposer.addr,
		ARG_DAO_APP_ID: daoAppInfo.appID,
	});

	// fund lsig's
	await Promise.all([
		deployer.fundLsig(
			"daoFundLsig",
			{ funder: creator, fundingMicroAlgo: 5e6 },
			{} // 5 algo
		),

		deployer.fundLsig(
			"proposalLsig",
			{ funder: creator, fundingMicroAlgo: 5e6 },
			{} // 5 algo
		),
	]);

	console.log("* ASA distribution (Gov tokens) *");
	const daoFundLsig = deployer.getLsig("daoFundLsig");
	await Promise.all([
		deployer.optInLsigToASA(govToken.assetIndex, daoFundLsig, { totalFee: 1000 }),
		deployer.optInAccountToASA(govToken.assetIndex, proposer.name, {}),
		deployer.optInAccountToASA(govToken.assetIndex, voterA.name, {}),
		deployer.optInAccountToASA(govToken.assetIndex, voterB.name, {}),
	]);

	const distributeGovTokenParams = {
		type: types.TransactionType.TransferAsset,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		amount: 100,
		assetID: govToken.assetIndex,
		payFlags: { totalFee: 1000 },
	};
	await tryExecuteTx(deployer, [
		{ ...distributeGovTokenParams, toAccountAddr: proposer.addr },
		{ ...distributeGovTokenParams, toAccountAddr: voterA.addr },
		{ ...distributeGovTokenParams, toAccountAddr: voterB.addr },
	]);

	console.log("Contracts deployed successfully!");
}

module.exports = { default: run };
