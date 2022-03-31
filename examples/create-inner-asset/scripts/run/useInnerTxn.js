const { executeTx } = require("@algo-builder/algob");
const { ALGORAND_ACCOUNT_MIN_BALANCE } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { APP_NAME, accounts } = require("../setup");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	const proxyAppInfo = deployer.getApp("MasterApp");

	// create asset and log new asset id
	const masterTxnParam = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		appID: proxyAppInfo.appID,
		appArgs: ["str:create_by_inner_txn"],
		payFlags: {
			totalFee: 2000,
		},
	};

	const receiptTx = await executeTx(deployer, [masterTxnParam]);

	console.log(receiptTx);
}

module.exports = { default: run };
