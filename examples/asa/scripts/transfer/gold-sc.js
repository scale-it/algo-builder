/**
 * Description:
 * This file demonstrates the example to transfer Algorand Standard Assets(ASA) & MicroAlgos
 * from one account to another according to smart contract (ASC) logic
*/
const { transferAlgo, transferASA } = require("./common");
const { transferMicroAlgosLsigAtomic } = require("algob");

async function run(runtimeEnv, deployer) {
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  // Transactions for GOLD ASA contract : '4-gold-asa.teal'  (Delegated Approval Mode)
  const lsigGoldOwner = deployer.getDelegatedLsig('4-gold-asa.teal');
  
  const assetID =  deployer.asa.get("gold").assetIndex;
  // Transaction PASS - As according to .teal logic, amount should be <= 1000
  await transferASA(deployer, goldOwnerAccount, johnAccount.addr, 500, assetID, lsigGoldOwner);

  // Transaction FAIL - As according to .teal logic, amount should be <= 1000
  await transferASA(deployer, goldOwnerAccount, johnAccount.addr, 1500, assetID, lsigGoldOwner);

  // Transaction FAIL - sender should be the delegator i.e account which signed the lsig (goldOwner in this case)
  await transferASA(deployer, johnAccount, bobAccount.addr, 100, assetID, lsigGoldOwner);

  
  // Transaction for ALGO - Contract : '3-gold-delegated-asc.teal'  (Delegated Approval Mode)
  const logicSignature = deployer.getDelegatedLsig('3-gold-delegated-asc.teal');

  // Transaction PASS - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, goldOwnerAccount, bobAccount.addr, 58, logicSignature);

  // Transaction FAIL - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, goldOwnerAccount, bobAccount.addr, 580, logicSignature);
} 

module.exports = { default: run }
