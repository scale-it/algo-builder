/**
 * Description:
 * This file demonstrates the example to transfer MicroAlgos
 * from contract account (contract approval mode) to another according to smart contract (ASC) logic
*/
const { transferAlgo, mkTxnParams, transferAlgoAtomic } = require('./common');

async function run(runtimeEnv, deployer) {
  const johnAccount = deployer.accountsByName.get("john-account");
  const elonMuskAccount = deployer.accountsByName.get("elon-musk-account");

  // Transactions for Transaction for ALGO - Contract : '2-gold-contract-asc.teal'  (Contract Mode)
  // sender is contract account
  const lsig = await deployer.loadLogic("2-gold-contract-asc.teal");
  const sender = lsig.address(); 
  // Transaction PASS - As according to .teal logic, amount should be <= 100 and receiver should be john
  await transferAlgo(deployer, { addr: sender}, johnAccount.addr, 20, lsig);
  
  // Transaction FAIL - Gets rejected by logic - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, { addr: sender}, johnAccount.addr, 200, lsig);

  // Transaction FAIL as Elon tried to receive instead of John
  await transferAlgo(deployer, { addr: sender}, elonMuskAccount.addr, 50, lsig);

  //group transactions
  let txnParams = [
    mkTxnParams({addr: sender}, johnAccount.addr, 30, lsig, {}),
    mkTxnParams({addr: sender}, johnAccount.addr, 20, lsig, {})]
  
  // Transaction PASS - for both transactions amount <= 100 and receiver is john
  await transferAlgoAtomic(deployer, txnParams);
  
  txnParams = [
    mkTxnParams({addr: sender}, johnAccount.addr, 200, lsig, { note: "ALGO PAID" }),
    mkTxnParams({addr: sender}, johnAccount.addr, 20, lsig, { note: "ALGO PAID" })]
  
  // Transaction FAIL - since for the first transaction amount = 200 (which is > 100, so both transactions will fail)
  await transferAlgoAtomic(deployer, txnParams);
}

module.exports = { default: run }
