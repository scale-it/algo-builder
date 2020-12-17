/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
*/
const { executeTransaction, TransactionType, SignType } = require('algob');
const { prepareParameters } = require('./withdraw/common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const { alice, bob, scTmplParams } = prepareParameters(deployer);

  /**** firstly we fund Alice and Bob accounts ****/
  const bobFunding = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: bob.addr,
    amountMicroAlgos: 10e6, // 10 Algos
    payFlags: { note: 'funding account' }
  };
  const aliceFunding = Object.assign({}, bobFunding);
  aliceFunding.toAccountAddr = alice.addr;
  aliceFunding.amountMicroAlgos = 1e5; // 0.1 Algo
  await Promise.all([
    executeTransaction(deployer, bobFunding), executeTransaction(deployer, aliceFunding)
  ]);

  /**** now bob creates and deploys the escrow account ****/
  console.log('hash of the secret:', scTmplParams.hash_image);
  // hash: QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=

  await deployer.fundLsig('htlc.py',
    { funder: bob, fundingMicroAlgo: 2e6 }, {}, [], scTmplParams);
}

module.exports = { default: run };
;
