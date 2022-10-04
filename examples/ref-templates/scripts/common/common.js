const { types } = require("@algo-builder/web");

async function tryExecuteTx(deployer, txnParams) {
	try {
		const txnParameters = Array.isArray(txnParams) ? txnParams : [txnParams];
		return await deployer.executeTx(txnParameters);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
		throw e;
	}
}

function mkTxnParams(senderAccount, receiverAddr, amount, lsig, payFlags) {
	return {
		type: types.TransactionType.TransferAlgo,
		sign: types.SignType.LogicSignature,
		fromAccountAddr: senderAccount.addr,
		toAccountAddr: receiverAddr,
		amountMicroAlgos: amount,
		lsig: lsig,
		payFlags: payFlags,
	};
}

module.exports = {
	tryExecuteTx,
	mkTxnParams,
};
