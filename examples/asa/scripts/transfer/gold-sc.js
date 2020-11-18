/**
 * Description:
 * This file demonstrates the example to transfer Algorand Standard Assets(ASA) & MicroAlgos
 * from one account to another according to smart contract (ASC) logic
*/
const { executeTransaction } = require("./common");
const { TransactionType, SignType } = require("algob");

async function run(runtimeEnv, deployer) {
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  // Transactions for GOLD ASA contract : '4-gold-asa.teal'  (Delegated Approval Mode)
  const lsigGoldOwner = deployer.getDelegatedLsig('4-gold-asa.teal');
  
  const assetID =  deployer.asa.get("gold").assetIndex;
  let txnParam = {
    type: TransactionType.TransferAsset,
    sign: SignType.LogicSignature,
    fromAccount: goldOwnerAccount,
    toAccountAddr: johnAccount.addr,
    amount: 500,
    assetID: assetID,
    lsig: lsigGoldOwner,
    payFlags: {}
  }

  // Transaction PASS - As according to .teal logic, amount should be <= 1000
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - As according to .teal logic, amount should be <= 1000
  txnParam.amount = 1500;
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - sender should be the delegator i.e account which signed the lsig (goldOwner in this case)
  txnParam.amount = 100;
  txnParam.toAccountAddr = bobAccount.addr;
  await executeTransaction(deployer, txnParam);

  
  // Transaction for ALGO - Contract : '3-gold-delegated-asc.teal'  (Delegated Approval Mode)
  const logicSignature = deployer.getDelegatedLsig('3-gold-delegated-asc.teal');

  txnParam = {
    type: TransactionType.TransferAlgo,
    sign: SignType.LogicSignature,
    fromAccount: goldOwnerAccount,
    toAccountAddr: bobAccount.addr,
    amountMicroAlgos: 58,
    lsig: logicSignature,
    payFlags: {}
  }
  // Transaction PASS - As according to .teal logic, amount should be <= 100
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - As according to .teal logic, amount should be <= 100
  txnParam.amountMicroAlgos = 580;
  await executeTransaction(deployer, txnParam);
} 

module.exports = { default: run }
