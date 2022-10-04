/**
 * Descrpition:
 * In this scripts, you will execute a group of transaction whichh consist:
 *   + Create new application transaction
 *   + Give money to the old address account application transaction
 *   + Call the old application transaction with argument fund
 */
const { types } = require("@algo-builder/web");
const { convert, balanceOf } = require("@algo-builder/algob");
const algosdk = require("algosdk");
const { tryExecuteTx } = require("../common/common");

async function run(runtimeEnv, deployer) {
	const john = deployer.accountsByName.get("john");

	//Get the app that have been created and funded it
	const appInfo = await deployer.getApp("proxy_trampoline");
	const appArgs = [convert.stringToBytes("fund")];

	//Transaction that create a new application
	const createAppTxnParam = {
		type: types.TransactionType.DeployApp,
		sign: types.SignType.SecretKey,
		fromAccount: john,
		appDefinition: {
			metaType: types.MetaType.FILE,
			appName: "trampoline",
			approvalProgramFilename: "approval.teal",
			clearProgramFilename: "clear.teal",
			localInts: 0,
			localBytes: 0,
			globalInts: 0,
			globalBytes: 0,
		},
		payFlags: {
			totalFee: 1000,
		},
	};

	// Transaction that will transfer money to the new application
	const fundAppTxtParam = {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: john,
		toAccountAddr: appInfo.applicationAccount,
		amountMicroAlgos: 5000000, //5 algos
		payFlags: {
			totalFee: 2000,
		},
	};
	// Transaction application call
	const callAppTxn = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: john,
		appID: appInfo.appID,
		appArgs: appArgs,
		payFlags: {
			totalFee: 1000,
		},
	};

	const receiptsTx = await tryExecuteTx(deployer, [
		createAppTxnParam,
		fundAppTxtParam,
		callAppTxn,
	]);

	// log all transaction have been confirmed including application-index created
	console.log(receiptsTx);

	// Log all the information of the new application created
	const appID = receiptsTx[0]["application-index"];
	const trampolineAddr = algosdk.getApplicationAddress(appID);

	console.log("Application index: ", appID);
	console.log("Application address: ", trampolineAddr);
	console.log(
		"Balance of new trampoline application: ",
		await balanceOf(deployer, trampolineAddr)
	);
}

module.exports = { default: run };
