const { executeSignedTxnFromFile } = require('@algo-builder/algob');

async function run (runtimeEnv, deployer) {
  /* Spec txnParams is encoded in john-to-bob.txn
  const john = deployer.accountsByName.get('john');
  const bob = deployer.accountsByName.get('bob');
  const txnParam = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: john,
    toAccountAddr: bob.addr,
    amountMicroAlgos: 20,
    payFlags: { totalFee: 1000 }
  }; */

  try {
    await executeSignedTxnFromFile(deployer, 'john-to-bob.txn');
  } catch (e) {
    console.log(e.response ? e.response.error : e);
  }
}

module.exports = { default: run };
