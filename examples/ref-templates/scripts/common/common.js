const { executeTransaction } = require('@algorand-builder/algob');
const { TransactionType, SignType } = require('@algorand-builder/runtime/build/types');

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e.error);
  }
};

exports.mkTxnParams = function (senderAccount, receiverAddr, amount, lsig, payFlags) {
  return {
    type: TransactionType.TransferAlgo,
    sign: SignType.LogicSignature,
    fromAccount: senderAccount,
    toAccountAddr: receiverAddr,
    amountMicroAlgos: amount,
    lsig: lsig,
    payFlags: payFlags
  };
};
