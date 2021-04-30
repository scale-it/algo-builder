/**
 * Description:
 * This file demonstrates the example to transfer Algorand Standard Assets(ASA) & MicroAlgos
 * using delegated lsig (between 2 user accounts).
*/
const { executeTransaction } = require('./common');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const goldOwner = deployer.accountsByName.get('alice');
  const john = deployer.accountsByName.get('john');
  const bob = deployer.accountsByName.get('bob');

  // Transactions for GOLD ASA contract : '4-gold-asa.teal'  (Delegated Approval Mode)
  const lsigGoldOwner = deployer.getDelegatedLsig('4-gold-asa.teal');

  const assetID = deployer.asa.get('gold').assetIndex;
  let txnParam = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.LogicSignature,
    fromAccountAddr: goldOwner.addr,
    toAccountAddr: john.addr,
    amount: 500,
    assetID: assetID,
    lsig: lsigGoldOwner,
    payFlags: { totalFee: 1000 }
  };

  // Transaction PASS
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - rejected by lsig because amount is not <= 1000
  txnParam.amount = 1500;
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - rejected by lsig because sender must be the delegator i.e
  // account which signed the lsig (goldOwner in this case)
  txnParam.amount = 100;
  txnParam.fromAccountAddr = bob.addr;
  await executeTransaction(deployer, txnParam);

  // Transaction for ALGO - Contract : '3-gold-delegated-asc.teal'  (Delegated Approval Mode)
  const logicSignature = deployer.getDelegatedLsig('3-gold-delegated-asc.teal');

  txnParam = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.LogicSignature,
    fromAccountAddr: goldOwner.addr,
    toAccountAddr: bob.addr,
    amountMicroAlgos: 58,
    lsig: logicSignature,
    payFlags: { totalFee: 1000 }
  };
  // Transaction PASS
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - rejected by lsig because amount is not <= 100
  txnParam.amountMicroAlgos = 580;
  await executeTransaction(deployer, txnParam);
}

module.exports = { default: run };
