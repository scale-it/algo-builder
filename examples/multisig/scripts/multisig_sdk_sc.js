/**
 * Description:
 * This script demonstrates how to
   - create a signed lsig using sdk and use that lsig to validate transactions
*/
const { executeTransaction } = require('./common/common');
const { createMsigAddress } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const alice = deployer.accountsByName.get('alice');
  const john = deployer.accountsByName.get('john');
  const bob = deployer.accountsByName.get('bob');

  // Generate multi signature account hash
  const addrs = [alice.addr, john.addr, bob.addr];
  const [mparams, multsigaddr] = createMsigAddress(1, 2, addrs); // passing (version, threshold, address list)

  // Get logic Signature
  const lsig = await deployer.loadLogic('sample-asc.teal', []);

  lsig.sign(alice.sk, mparams); // lsig signed by alice's secret_key
  lsig.appendToMultisig(john.sk); // lsig signed again (threshold = 2) by john secret_key

  const txnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: multsigaddr,
    amountMicroAlgos: 10000000,
    lsig: lsig,
    payFlags: { note: 'Funding multisig account', totalFee: 1000 }
  };
  // Funding multisignature account
  await executeTransaction(deployer, txnParams);

  await deployer.addCheckpointKV('User Checkpoint', 'Fund Multisignature Account');

  txnParams.fromAccount = { addr: multsigaddr };
  txnParams.toAccountAddr = bob.addr;
  txnParams.sign = types.SignType.LogicSignature;
  txnParams.amountMicroAlgos = 58;
  // Transaction PASS - according to sample-asc.teal logic, amount should be <= 100
  await executeTransaction(deployer, txnParams);

  txnParams.amountMicroAlgos = 580;
  // Transaction FAIL - according to sample-asc.teal logic, amount should be <= 100
  await executeTransaction(deployer, txnParams);
}

module.exports = { default: run };
