const { TransactionType, SignType, executeTransaction } = require("algob");

exports.executeTransaction = async function (deployer, txnParams) {
    try {
        const details = await executeTransaction(deployer, txnParams);
    } catch (e) {
        console.error('Transaction Failed', e.response.error);
    }
}   

exports.mkParam = function (senderAccount, receiverAddr, amount, payFlags) {
    return {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: senderAccount,
        toAccountAddr: receiverAddr,
        amountMicroAlgos: amount,
        payFlags: payFlags
    }
}
