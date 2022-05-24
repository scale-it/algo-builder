const { types } = require("@algo-builder/web");
require("dotenv").config();

const showError = () => {
	// show error if IGNORE_TX_FAIL = false
	if (process.env.IGNORE_TX_FAIL) {
		return process.env.IGNORE_TX_FAIL === "false";
	}
	// default not show error
	return true;
};

exports.tryExecuteTx = async function (deployer, txnParams) {
	try {
		if (Array.isArray(txnParams)) await deployer.executeTx(txnParams);
		else await deployer.executeTx([txnParams]);
	} catch (e) {
		if (showError()) {
			console.error("Transaction Failed", e.response ? e.response.error : e);
		}
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
