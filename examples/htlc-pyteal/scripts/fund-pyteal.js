/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
*/
const { executeTransaction, TransactionType, SignType } = require('algob');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const bob = deployer.accountsByName.get('bob'); // Buyer

  const txnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: bob.addr,
    amountMicroAlgos: 200000000,
    payFlags: { note: 'funding account' }
  };
  await executeTransaction(deployer, txnParams);
  // secret value hashed with sha256 will produce our image
  // hash : QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=
  const secret = 'hero wisdom green split loop element vote belt';

  await deployer.fundLsig('htlc.py',
    { funder: bob, fundingMicroAlgo: 202000000 }, {}, [secret]);
}

module.exports = { default: run };
