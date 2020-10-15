/**
 * Description:
 * This file demonstrates the example to transfer MicroAlgos
 * from contract account (contract approval mode) to another according to smart contract (ASC) logic
*/
const { transferAlgo } = require('./common');
const logicsig = require('algosdk/src/logicsig');
const { decode } = require('@msgpack/msgpack');

async function run(runtimeEnv, deployer) {
  const johnAccount = deployer.accountsByName.get("john-account");
  const elonMuskAccount = deployer.accountsByName.get("elon-musk-account");

  // Transactions for Transaction for ALGO - Contract : '2-gold-contract-asc.teal'  (Contract Mode)
  //const lsig = await deployer.getLogicSignature("2-gold-contract-asc.teal", []);
  // sender is contract account
  const result = deployer.lsig.get("2-gold-contract-asc.teal").logicSignature;
  const lsig = decode(result);
  const dummyProgram = new Uint8Array([
    1,  32,   2,   1, 100,  38,   1,  32, 213,   3, 149,
   22,  62, 136, 178, 191, 199,  92, 201, 183, 175, 213,
   79, 155, 211,  71, 149, 158, 180, 205, 247, 164, 218,
  202,  87,  77, 111, 133, 236,  77,  49,  16,  34,  18,
   49,   7,  40,  18,  16,  49,   8,  35,  14,  16
]);
  let lsig2 = new logicsig.LogicSig(dummyProgram, []);
  Object.assign(lsig2, lsig)
  const sender = lsig2.address(); 
  // Transaction PASS - As according to .teal logic, amount should be <= 100 and receiver should be john
  await transferAlgo(deployer, { addr: sender}, johnAccount.addr, 20, lsig2);
  
  // Transaction FAIL - Gets rejected by logic - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, { addr: sender}, johnAccount.addr, 200, lsig2);

  // Transaction FAIL as Elon tried to receive instead of John
  await transferAlgo(deployer, { addr: sender}, elonMuskAccount.addr, 50, lsig2);
}

module.exports = { default: run }
