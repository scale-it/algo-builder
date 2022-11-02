const { types } = require("@algo-builder/web");

exports.tryExecuteTx = async function (deployer, txnParams) {
	try {
		const txnParameters = Array.isArray(txnParams) ? txnParams : [txnParams];
		return await deployer.executeTx(txnParameters);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
		throw e;
	}
};

exports.mkParam = function (senderAccount, receiverAddr, amount, payFlags) {
	return {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.SecretKey,
		fromAccount: senderAccount,
		toAccountAddr: receiverAddr,
		amountMicroAlgos: amount,
		payFlags: payFlags,
	};
};
