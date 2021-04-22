const { executeTransaction } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e);
  }
};

/**
 * Fund an account from master with some algos (= 20)
 * @param {*} deployer algobDeployer
 * @param {*} account account to fund algos(20)
 */
exports.fundAccount = async function (deployer, account) {
  const master = deployer.accountsByName.get('master-account');

  try {
    console.log(`* Funding Account:${account.name} *`);
    await executeTransaction(deployer, {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master,
      toAccountAddr: account.addr,
      amountMicroAlgos: 20e6,
      payFlags: { totalFee: 1000, note: 'funding account' }
    });
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e);
  }
};

exports.totalSupply = async function (deployer, account) {
  // TODO: use deployer.loadASA to get assest total
  // asa.total - asa.balanceOf(reserve)
};
