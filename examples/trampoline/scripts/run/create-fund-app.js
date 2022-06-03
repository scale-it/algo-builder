/**
 * Descrpition:
 * This function deploy the app for the first time
 */
const { types } = require("@algo-builder/web");
const { convert } = require("@algo-builder/algob");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
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

	//Transaction that will transfer money to the new application
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
	//Transaction application call
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

	await deployer.executeTx(createAppTxnParam);
	const receiptsTx = await deployer.executeTx([createAppTxnParam, fundAppTxtParam, callAppTxn]);

	// log all transaction have been confirmed including application-index created
	console.log(receiptsTx);
}

module.exports = { default: run };
