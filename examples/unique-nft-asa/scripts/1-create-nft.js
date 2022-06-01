const { types } = require("@algo-builder/web");
const { accounts, tryExecuteTx, p } = require("./run/common/common.js");

async function createNFT(deployer, creator, p) {
	const nftAppInfo = deployer.getApp("NftApp");
	const statelessPrimeLsig = await deployer.loadLogicByFile("stateless.py", {
		ARG_P: p,
		ARG_NFT_APP_ID: nftAppInfo.appID,
	});

	const txGroup = [
		/**
		 * tx 0 - Payment of 1 ALGO to C_p (doesn't necessarily have to be creator)
		 */
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: creator,
			toAccountAddr: statelessPrimeLsig.address(),
			amountMicroAlgos: 1e6,
			payFlags: { totalFee: 1000 },
		},
		/**
		 * tx 1 - OptIn to NFT App (by creator)
		 */
		{
			type: types.TransactionType.OptInToApp,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: statelessPrimeLsig.address(),
			appID: nftAppInfo.appID,
			payFlags: { totalFee: 1000 },
			lsig: statelessPrimeLsig,
			appArgs: [`int:${p}`],
		},
		/**
		 * tx 2 - Deploy ASA by C_p
		 */
		{
			type: types.TransactionType.DeployASA,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: statelessPrimeLsig.address(),
			asaName: "nft-asa",
			lsig: statelessPrimeLsig,
			payFlags: { totalFee: 1000 },
		},
	];

	await tryExecuteTx(deployer, txGroup);

	console.log(`NFT created by [${creator.name}:${creator.addr}], p = ${p}`);
}

async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	await createNFT(deployer, creator, p);
}

module.exports = { default: run };
