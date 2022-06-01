const { types } = require("@algo-builder/web");
const { balanceOf } = require("@algo-builder/algob");
const { accounts, tryExecuteTx, p } = require("./common/common.js");

async function transferNFT(deployer, creator, p) {
	const nftAppInfo = deployer.getApp("NftApp");
	const asaInfo = deployer.asa.get("nft-asa");
	const statelessPrimeLsig = await deployer.loadLogicByFile("stateless.py", {
		ARG_P: p,
		ARG_NFT_APP_ID: nftAppInfo.appID,
	});

	const txGroup = [
		// tx 0 - Call App
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: statelessPrimeLsig.address(),
			appID: nftAppInfo.appID,
			payFlags: { totalFee: 1000 },
			lsig: statelessPrimeLsig,
		},
		// tx 1 - transfer NFT (ASA with supply 1) from C_p => creator
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: statelessPrimeLsig.address(),
			toAccountAddr: creator.addr,
			amount: 1,
			assetID: asaInfo.assetIndex,
			lsig: statelessPrimeLsig,
			payFlags: { totalFee: 1000 },
		},
	];

	await tryExecuteTx(deployer, txGroup);

	console.log(`NFT transferred to [${creator.name}:${creator.addr}], p = ${p}`);
	console.log("Balance: ", await balanceOf(deployer, creator.addr, asaInfo.assetIndex));
}

async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	// opt-in to ASA by creator
	const asaInfo = deployer.asa.get("nft-asa");
	await deployer.optInAccountToASA(asaInfo.assetIndex, creator.name, {});

	// Transfer NFT from C_p to creator
	await transferNFT(deployer, creator, p);
}

module.exports = { default: run };
