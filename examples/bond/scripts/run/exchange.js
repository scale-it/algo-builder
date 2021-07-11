const {
  executeTransaction, convert
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const storeManagerAccount = deployer.accountsByName.get('alice');
  const creatorAccount = deployer.accountsByName.get('john');

  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: storeManagerAccount.addr,
    amountMicroAlgos: 200000000,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);
  algoTxnParams.toAccountAddr = creatorAccount.addr;
  await executeTransaction(deployer, algoTxnParams);
}

module.exports = { default: run };
