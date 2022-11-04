/**
 * Description:
 * This file creates a new NFT and transfers 1 NFT from A to B
 */
const { printGlobalNFT, printLocalNFT, tryExecuteTx } = require("./common");
const { convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const john = deployer.accountsByName.get("john");

	const appInfo = await deployer.getApp("nft");
	const appID = appInfo.appID;
	console.log(appInfo);

	await printGlobalNFT(deployer, masterAccount.addr, appID); // Global Count before creation

	const nftRef = "https://new-nft.com";

	// arguments: "create", nft_data_ref, data_hash
	let appArgs = ["create", nftRef, "1234"].map(convert.stringToBytes);

	let txnParam = [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: masterAccount,
			appID: appID,
			payFlags: {},
			appArgs,
		},
	];
	await tryExecuteTx(deployer, txnParam); // creates new nft (with id = 1)

	// print Global Count after creation
	await printGlobalNFT(deployer, masterAccount.addr, appID);

	// *** Transfer NFT from master to john ***

	await printLocalNFT(deployer, masterAccount.addr, appID);
	await printLocalNFT(deployer, john.addr, appID);

	const nftID = new Uint8Array(8).fill(1, 7); // [0, 0, 0, 0, 0, 0, 0, 1] = uint64(1)
	appArgs = [
		"str:transfer", // appArgs similar to goal are also supported
		nftID,
	];

	// transfer nft from master to john
	// account_A = master, account_B = john
	txnParam = [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: masterAccount,
			appID: appID,
			payFlags: {},
			accounts: [masterAccount.addr, john.addr],
			appArgs,
		},
	];
	await tryExecuteTx(deployer, txnParam);

	await printLocalNFT(deployer, masterAccount.addr, appID);
	await printLocalNFT(deployer, john.addr, appID);
}

module.exports = { default: run };
