/**
 * Description:
 * This file demonstrates the example to transfer Algorand Standard Assets(ASA) & MicroAlgos
 * from one account to another according to smart contract (ASC) logic
*/
const { executeTransaction } = require('./common');
const { TransactionType, SignType } = require('@algorand-builder/algob');

async function run (runtimeEnv, deployer) {
  const goldOwner = deployer.accountsByName.get('alice');
  const john = deployer.accountsByName.get('john');
  const bob = deployer.accountsByName.get('bob');

  // Transactions for GOLD ASA contract : '4-gold-asa.teal'  (Delegated Approval Mode)
  const lsigGoldOwner = deployer.getDelegatedLsig('4-gold-asa.teal');

  const assetID = deployer.asa.get('gold').assetIndex;
  let txnParam = {
    type: TransactionType.TransferAsset,
    sign: SignType.LogicSignature,
    fromAccount: goldOwner,
    toAccountAddr: john.addr,
    amount: 500,
    assetID: assetID,
    lsig: lsigGoldOwner,
    payFlags: { totalFee: 1000 }
  };

  // Transaction PASS - As according to .teal logic, amount should be <= 1000
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - As according to .teal logic, amount should be <= 1000
  txnParam.amount = 1500;
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - sender should be the delegator i.e
  // account which signed the lsig (goldOwner in this case)
  txnParam.amount = 100;
  txnParam.fromAccount = bob;
  await executeTransaction(deployer, txnParam);

  // Transaction for ALGO - Contract : '3-gold-delegated-asc.teal'  (Delegated Approval Mode)
  const logicSignature = deployer.getDelegatedLsig('3-gold-delegated-asc.teal');

  txnParam = {
    type: TransactionType.TransferAlgo,
    sign: SignType.LogicSignature,
    fromAccount: goldOwner,
    toAccountAddr: bob.addr,
    amountMicroAlgos: 58,
    lsig: logicSignature,
    payFlags: { totalFee: 1000 }
  };
  // Transaction PASS - As according to .teal logic, amount should be <= 100
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - As according to .teal logic, amount should be <= 100
  txnParam.amountMicroAlgos = 580;
  await executeTransaction(deployer, txnParam);
}

module.exports = { default: run };
