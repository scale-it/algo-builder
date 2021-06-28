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
 * Fund accounts from master with 20 Algos
 * @param {*} deployer algobDeployer
 * @param {*} account or list of accounts to fund
 */
exports.fundAccount = async function (deployer, account) {
  const master = deployer.accountsByName.get('master-account');
  const params = [];
  if (!(account instanceof Array)) {
    account = [account];
  }
  for (const a of account) {
    console.log(`* Funding Account: ${a.name} *`);
    params.push({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master,
      toAccountAddr: a.addr,
      amountMicroAlgos: 20e6,
      payFlags: { totalFee: 1000, note: 'funding account' }
    });
  }

  try {
    await executeTransaction(deployer, params);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error.text : e);
  }
};

exports.optInAccountToSSC = async function (deployer, account, appID, payflags, sscOptionalFlags) {
  try {
    console.log(`* Opting In: ${account.name} to SSC with application index: ${appID} *`);
    await deployer.optInAccountToSSC(account, appID, payflags, sscOptionalFlags);
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
