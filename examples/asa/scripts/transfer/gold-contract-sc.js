/**
 * Description:
 * This file demonstrates the example to transfer micro Algos and ASA's
 * from contract account (lsig) to a user account.
 * The logic assures that:
 *  + tx is payment and amount is <= 100 OR tx is AssetTransfer and AssetAmount is <= 100
 *  + fee is <= 1000
 *  + we don't do any rekey, closeRemainderTo
*/
const { types } = require('@algo-builder/runtime');
const { balanceOf } = require('@algo-builder/algob');
const { executeTransaction } = require('./common');

async function run (runtimeEnv, deployer) {
  const john = deployer.accountsByName.get('john');
  const bob = deployer.accountsByName.get('bob');

  // Transactions for Transaction for ALGO - Contract : '2-gold-contract-asc.teal'  (Contract Mode)
  // sender is contract account
  const lsig = await deployer.loadLogic('2-gold-contract-asc.teal');
  const senderAddress = lsig.address();

  const algoTxParam = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.LogicSignature,
    fromAccountAddr: senderAddress,
    toAccountAddr: john.addr,
    amountMicroAlgos: 20n, // bigint is also supported
    lsig: lsig,
    payFlags: { totalFee: 1000 }
  };
  // Transaction PASS - As according to .teal logic, amount should be <= 100
  await executeTransaction(deployer, algoTxParam);

  // Transaction FAIL - Gets rejected by logic - As according to .teal logic, amount should be <= 100
  const invalidParams = Object.assign({}, algoTxParam);
  invalidParams.amountMicroAlgos = 200;
  await executeTransaction(deployer, invalidParams);

  /* Transfer ASA 'gold' from contract account to user account */
  const assetID = deployer.asa.get('gold').assetIndex;
  const assetTxParam = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.LogicSignature,
    fromAccountAddr: senderAddress,
    toAccountAddr: bob.addr,
    amount: 10,
    assetID: assetID,
    lsig: lsig,
    payFlags: { totalFee: 1000 }
  };

  // Transaction PASS - As according to .teal logic, asset amount should be <= 100
  await executeTransaction(deployer, assetTxParam);
  // print assetHolding of bob
  await balanceOf(deployer, bob.addr, assetID);

  // Transaction FAIL - Gets rejected by logic - As according to .teal logic, amount should be <= 100
  const invalidTxParams = Object.assign({}, assetTxParam);
  invalidTxParams.amount = 500;
  await executeTransaction(deployer, invalidTxParams);
}

module.exports = { default: run };
