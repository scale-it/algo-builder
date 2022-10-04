const { types } = require("@algo-builder/web");
require("dotenv").config();

exports.tryExecuteTx = async function (deployer, txnParams) {
	try {
		if (Array.isArray(txnParams)) await deployer.executeTx(txnParams);
		else await deployer.executeTx([txnParams]);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
		throw e;
	}
};

exports.mkTxnParams = function (senderAccount, receiverAddr, amount, lsig, payFlags) {
	return {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.LogicSignature,
		fromAccountAddr: senderAccount.addr,
		toAccountAddr: receiverAddr,
		amountMicroAlgos: amount,
		lsig: lsig,
		payFlags: payFlags,
	};
};
