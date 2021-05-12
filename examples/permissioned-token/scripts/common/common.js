const { executeTransaction, balanceOf } = require('@algo-builder/algob');
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

exports.optInAccountToSSC = async function (deployer, account, appId, payflags, sscOptionalFlags) {
  try {
    console.log(`* Opting In: ${account.name} to SSC with application index: ${appId} *`);
    await deployer.optInAccountToSSC(account, appId, payflags, sscOptionalFlags);
  } catch (e) {
    console.error('optInAccountToSSC failed', e.response?.error); // probably app already optedIn
  }
};

// returns totalSupply of asset (0 after deployment, will increase will each issuance transaction)
exports.totalSupply = async function (deployer, assetIndex) {
  const asaDef = (await deployer.getAssetByID(assetIndex)).params;
  const reserveAssetHolding = await balanceOf(deployer, asaDef.reserve, assetIndex);
  return BigInt(asaDef.total) - BigInt(reserveAssetHolding.amount);
};
