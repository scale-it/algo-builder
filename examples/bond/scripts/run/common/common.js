const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

const issuePrice = 1000;

const asaDef = {
  total: 1000000,
  decimals: 0,
  defaultFrozen: false,
  unitName: 'BOND',
  url: 'url',
  metadataHash: '12312442142141241244444411111133',
  noteb64: 'noteb64',
  manager: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
  reserve: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
  freeze: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE'
};

// fund account using master account
async function fundAccount (deployer, accountAddress) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: accountAddress,
    amountMicroAlgos: 200e6,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);
}

function optInTx () {

}

module.exports = { issuePrice, asaDef, fundAccount };
