/**
 * Description:
 * This file demonstrates the example to transfer Algorand Standard Assets(ASA) & MicroAlgos
 * from one account to another according to smart contract (ASC) logic
*/
const { transferAlgo, transferASA } = require("./common");

async function run(runtimeEnv, deployer) {
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  // Transactions for GOLD ASA contract : '4-gold-asa.teal'  (Delegated Approval Mode)
  const lsig = await deployer.getLogicSignature("4-gold-asa.teal", []);
  const lsigJohn = lsig;
  lsigJohn.sign(johnAccount.sk);
  const lsigGoldOwner = lsig;
  lsigGoldOwner.sign(goldOwnerAccount.sk);
  const assetID =  deployer.asa.get("gold").assetIndex;
  // Transaction PASS - As according to .teal logic, amount should be <= 1000
  await transferASA(deployer, goldOwnerAccount, johnAccount.addr, 500, assetID, lsigGoldOwner);

  // Transaction FAIL - As according to .teal logic, amount should be <= 1000
  await transferASA(deployer, goldOwnerAccount, johnAccount.addr, 1500, assetID, lsigGoldOwner);

  // Transaction FAIL as John tried to send instead of GoldOwner
  await transferASA(deployer, johnAccount, bobAccount.addr, 100, assetID, lsigJohn);

  // Transaction for ALGO - Contract : '3-gold-delegated-asc.teal'  (Delegated Approval Mode)
  const logicSignature = await deployer.getLogicSignature("3-gold-delegated-asc.teal", []);
  logicSignature.sign(goldOwnerAccount.sk);

  // Transaction PASS - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, goldOwnerAccount, bobAccount.addr, 58, logicSignature);

  // Transaction FAIL - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, goldOwnerAccount, bobAccount.addr, 580, logicSignature);
  
}

module.exports = { default: run }
