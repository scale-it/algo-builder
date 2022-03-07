const { fundAccount, accounts, p } = require("./run/common/common.js");

async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	// fund account
	await fundAccount(deployer, [creator]);

	// Create App
	const nftAppInfo = await deployer.deployApp(
		"nft-app-approval.py",
		"nft-app-clear.py",
		{
			sender: creator,
			localInts: 1, // p
			localBytes: 1, // creator
		},
		{}
	);
	console.log(nftAppInfo);

	// fund C_p lsig
	await deployer.fundLsigByFile(
		"stateless.py",
		{ funder: creator, fundingMicroAlgo: 1e6 },
		{}, // 1 algo
		{ ARG_P: p, ARG_NFT_APP_ID: nftAppInfo.appID }
	);

	console.log("Contracts deployed successfully!");
}

module.exports = { default: run };
