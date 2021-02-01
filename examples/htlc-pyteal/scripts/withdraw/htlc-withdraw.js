/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
 * In this scheme, the buyer funds a TEAL account with the sale price.
 * The buyer also picks a secret value and encodes a secure hash of this value in
 * the TEAL program. The TEAL program will transfer its balance to the seller
 * if the seller is able to provide the secret value that corresponds to the hash in the program.
*/
const { stringToBytes } = require('@algorand-builder/algob');
const { TransactionType, SignType } = require('@algorand-builder/runtime/build/types');
const { executeTransaction, prepareParameters } = require('./common');

async function run (runtimeEnv, deployer) {
  const { alice, scTmplParams, secret } = prepareParameters(deployer);
  const wrongSecret = 'hero wisdom red split loop element vote belt';

  let lsig = await deployer.loadLogic('htlc.py', [stringToBytes(wrongSecret)], scTmplParams);
  let sender = lsig.address();

  const txnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.LogicSignature,
    fromAccount: { addr: sender },
    toAccountAddr: alice.addr,
    amountMicroAlgos: 200,
    lsig: lsig,
    payFlags: { totalFee: 1000 }
  };
  // Transaction Fails : as wrong secret value is used
  await executeTransaction(deployer, txnParams);

  lsig = await deployer.loadLogic('htlc.py', [stringToBytes(secret)], scTmplParams);
  sender = lsig.address();

  // Transaction Passes : as right secret value is used
  txnParams.fromAccount = { addr: sender };
  txnParams.lsig = lsig;
  await executeTransaction(deployer, txnParams);
}

module.exports = { default: run };
