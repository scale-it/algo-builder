const { balanceOf } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");
const { tryExecuteTx } = require("./common");

async function run(runtimeEnv, deployer) {
	const teslaAssetID = deployer.asa.get("tesla").assetIndex;

	const john = deployer.accountsByName.get("john");
	const elon = deployer.accountsByName.get("elon-musk");

	await tryExecuteTx(deployer, [
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon,
			toAccountAddr: john.addr,
			amount: 184467440737095516n, // use bigint for large transfer amount
			assetID: "tesla", // passing asa name is also supported
			payFlags: { totalFee: 1000 },
		},
	]);

	console.log("Balance: ", await balanceOf(deployer, john.addr, teslaAssetID));
}

module.exports = { default: run };
