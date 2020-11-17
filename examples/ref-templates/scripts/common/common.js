const { TransactionType, SignType, executeTransaction } = require("algob");

exports.executeTransaction = async function (deployer, txnParams) {
    try {
      await executeTransaction(deployer, txnParams);
    } catch (e) {
       console.error('Transaction Failed', e.response.error);
    }
}

exports.mkTxnParams = function (senderAccount, receiverAddr, amount, lsig, payFlags) {
    return {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: senderAccount,
        toAccountAddr: receiverAddr,
        amountMicroAlgos: amount,
        lsig: lsig, 
        payFlags: payFlags
    }
}