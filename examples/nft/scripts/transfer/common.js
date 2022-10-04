const { readAppGlobalState, readAppLocalState } = require("@algo-builder/algob");
const { default: algosdk } = require("algosdk");

exports.tryExecuteTx = async function (deployer, txnParams) {
	try {
		const txnParameters = Array.isArray(txnParams) ? txnParams : [txnParams];
		return await deployer.executeTx(txnParameters);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
		throw e;
	}
};

exports.printGlobalNFT = async function (deployer, creator, appID) {
	try {
		const globalState = await readAppGlobalState(deployer, creator, appID);
		console.log("Global NFT Count:", globalState.get("total"));
	} catch (e) {
		console.error("Error Occurred", e);
	}
};

exports.printLocalNFT = async function (deployer, account, appID) {
	try {
		const localState = await readAppLocalState(deployer, account, appID);
		// each nft is stored as a one record in user store
		let holdings = [];
		if (localState === undefined) {
			holdings = "none";
		} else {
			for (const key of localState.keys()) {
				holdings.push(algosdk.bytesToBigInt(key));
			}
			holdings = holdings.join(" ");
		}
		console.log("%s account holds app(%s) NFTs: %s", account, appID, holdings);
	} catch (e) {
		console.error("Error Occurred", e);
	}
};
