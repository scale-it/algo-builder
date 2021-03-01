/**
 * Description:
 * This file demonstrates the example to transfer micro Algos
 * from contract account (lsig) to a user account.
 * The logic assures that:
 *  + receiver is 2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA (John)
 *  + tx is payment and amount is <- 100
 *  + fee is <= 1000
 *  + we don't do any rekey, closeReminderTo
*/
const { types } = require('@algorand-builder/runtime');
const { executeTransaction } = require('./common');

async function run (runtimeEnv, deployer) {
  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  // Transactions for Transaction for ALGO - Contract : '2-gold-contract-asc.teal'  (Contract Mode)
  // sender is contract account
  const lsig = await deployer.loadLogic('2-gold-contract-asc.teal', []);
  const sender = lsig.address();

  const txnParam = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.LogicSignature,
    fromAccount: { addr: sender },
    toAccountAddr: john.addr,
    amountMicroAlgos: 20n, // bigint is also supported
    lsig: lsig,
    payFlags: { totalFee: 1000 }
  };
  // Transaction PASS - As according to .teal logic, amount should be <= 100 and receiver should be john
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - rejected by lsig because amount is not <= 100
  txnParam.amountMicroAlgos = 200;
  await executeTransaction(deployer, txnParam);

  // Transaction FAIL - rejected by lsig because receiver is not John
  txnParam.amountMicroAlgos = 80;
  txnParam.toAccountAddr = elon.addr;
  await executeTransaction(deployer, txnParam);
}

module.exports = { default: run };
