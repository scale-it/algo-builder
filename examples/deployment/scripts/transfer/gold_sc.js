/**
 * Description:
 * This file demonstrates the example to transfer Algorand Standard Assets(ASA) & MicroAlgos
 * from one account to another according to smart contract (ASC) logic
*/
const { transferAlgo, transferASA } = require("./common");
const logicsig = require('algosdk/src/logicsig');
const { decode } = require('@msgpack/msgpack');

async function run(runtimeEnv, deployer) {
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  // Transactions for GOLD ASA contract : '4-gold-asa.teal'  (Delegated Approval Mode)
  const result = deployer.lsig.get("4-gold-asa.teal").logicSignature;
  const lsig = decode(result);
  const dummyProgram = new Uint8Array([
    1,  32,   2,   1, 100,  38,   1,  32, 213,   3, 149,
   22,  62, 136, 178, 191, 199,  92, 201, 183, 175, 213,
   79, 155, 211,  71, 149, 158, 180, 205, 247, 164, 218,
  202,  87,  77, 111, 133, 236,  77,  49,  16,  34,  18,
   49,   7,  40,  18,  16,  49,   8,  35,  14,  16
]);
  let lsigGoldOwner = new logicsig.LogicSig(dummyProgram, []);
  Object.assign(lsigGoldOwner, lsig)
  
  const assetID =  deployer.asa.get("gold").assetIndex;
  // Transaction PASS - As according to .teal logic, amount should be <= 1000
  await transferASA(deployer, goldOwnerAccount, johnAccount.addr, 500, assetID, lsigGoldOwner);

  // Transaction FAIL - As according to .teal logic, amount should be <= 1000
  await transferASA(deployer, goldOwnerAccount, johnAccount.addr, 1500, assetID, lsigGoldOwner);

  // Transaction FAIL as John tried to send instead of GoldOwner
  await transferASA(deployer, johnAccount, bobAccount.addr, 100, assetID, lsigGoldOwner);

  // Transaction for ALGO - Contract : '3-gold-delegated-asc.teal'  (Delegated Approval Mode)
  const logicSignature = deployer.lsig.get("3-gold-delegated-asc.teal").logicSignature;
  const lsig1 = decode(logicSignature);
  let gLsig = new logicsig.LogicSig(dummyProgram, []);
  Object.assign(gLsig, lsig1);

  // Transaction PASS - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, goldOwnerAccount, bobAccount.addr, 58, gLsig);

  // Transaction FAIL - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, goldOwnerAccount, bobAccount.addr, 580, gLsig);
  
}

module.exports = { default: run }
