const { types } = require("@algo-builder/web");
const { tryExecuteTx } = require("../common/common");
const { accounts, decodeValue } = require("../utils");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	const proxyAppInfo = deployer.getApp("coordinator");

	// create asset and log new asset id
	const masterTxnParam = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		appID: proxyAppInfo.appID,
		appArgs: ["str:create_by_inner_txn"],
		payFlags: {
			totalFee: 3000,
		},
	};

	const txReceipt = await tryExecuteTx(deployer, [masterTxnParam]);

	// get logs from transaction
	const logs = txReceipt[0].logs;
	console.log("New asset Id =", decodeValue(logs[0]));
	console.log("New application Id =", decodeValue(logs[1]));
}

module.exports = { default: run };
