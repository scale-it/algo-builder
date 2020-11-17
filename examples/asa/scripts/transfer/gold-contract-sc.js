/**
 * Description:
 * This file demonstrates the example to transfer MicroAlgos
 * from contract account (contract approval mode) to another according to smart contract (ASC) logic
*/
const { TransactionType, SignType} = require("algob");
const { executeTransaction } = require("./common");

async function run(runtimeEnv, deployer) {
  const johnAccount = deployer.accountsByName.get("john-account");
  const elonMuskAccount = deployer.accountsByName.get("elon-musk-account");

  // Transactions for Transaction for ALGO - Contract : '2-gold-contract-asc.teal'  (Contract Mode)
  // sender is contract account
  const lsig = await deployer.loadLogic("2-gold-contract-asc.teal");
  const sender = lsig.address();
  
  let txnParam = {
    type: TransactionType.TransferAlgo,
    sign: SignType.LogicSignature,
    fromAccount: {addr: sender},
    toAccountAddr: johnAccount.addr,
    amountMicroAlgos: 20,
    lsig: lsig,
    payFlags: {}
  }
  // Transaction PASS - As according to .teal logic, amount should be <= 100 and receiver should be john
  await executeTransaction(deployer, txnParam);
  
  // Transaction FAIL - Gets rejected by logic - As according to .teal logic, amount should be <= 100
  txnParam.amountMicroAlgos = 200;
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL as Elon tried to receive instead of John
  txnParam.amountMicroAlgos = 200;
  txnParam.toAccountAddr = elonMuskAccount.addr
  await executeTransaction(deployer, txnParam);

}

module.exports = { default: run }
