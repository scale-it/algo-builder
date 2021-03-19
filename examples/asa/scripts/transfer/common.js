const { executeTransaction } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e);
  }
};

exports.mkParam = function (senderAccount, receiverAddr, amount, payFlags) {
  return {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: senderAccount,
    toAccountAddr: receiverAddr,
    amountMicroAlgos: amount,
    payFlags: payFlags
  };
};
