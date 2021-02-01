const { executeTransaction } = require('@algorand-builder/algob');
const { TransactionType, SignType } = require('@algorand-builder/runtime/build/types');

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e.error);
  }
};

exports.mkParam = function (senderAccount, receiverAddr, amount, payFlags) {
  return {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: senderAccount,
    toAccountAddr: receiverAddr,
    amountMicroAlgos: amount,
    payFlags: payFlags
  };
};
