const { executeTransaction } = require('@algorand-builder/algob');
const { types } = require('@algorand-builder/runtime');

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e);
  }
};

exports.mkTxnParams = function (senderAccount, receiverAddr, amount, lsig, payFlags) {
  return {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.LogicSignature,
    fromAccount: senderAccount,
    toAccountAddr: receiverAddr,
    amountMicroAlgos: amount,
    lsig: lsig,
    payFlags: payFlags
  };
};
