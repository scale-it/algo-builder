const { executeTransaction, mkTxnParams } = require('./common/common');
const { globalZeroAddress, stringToBytes } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const john = deployer.accountsByName.get('john');

  // let's make sure john account is active and it has enough balance
  const txnParams = mkTxnParams(masterAccount, john.addr, 4e6, {}, { note: 'funding account' });
  txnParams.sign = types.SignType.SecretKey;
  await executeTransaction(deployer, txnParams);

  const secret = 'hero wisdom green split loop element vote belt';
  const wrongSecret = 'hero wisdom red split loop element vote belt';

  // setup a contract account and send 1 ALGO from master
  await deployer.fundLsig('htlc.py', {
    funder: masterAccount,
    fundingMicroAlgo: 1e6 // 1 Algo
  },
  { closeRemainderTo: john.addr }, []);

  await deployer.addCheckpointKV('User Checkpoint', 'Fund Contract Account');

  let contract = await deployer.loadLogic('htlc.py', [stringToBytes(wrongSecret)]);
  let contractAddress = contract.address();

  txnParams.fromAccount = { addr: contractAddress };
  txnParams.sign = types.SignType.LogicSignature;
  txnParams.toAccountAddr = globalZeroAddress;
  txnParams.amountMicroAlgos = 0;
  txnParams.lsig = contract;
  txnParams.payFlags = { totalFee: 1000, closeRemainderTo: john.addr };

  // Fails because wrong secret is provided
  await executeTransaction(deployer, txnParams);

  contract = await deployer.loadLogic('htlc.py', [stringToBytes(secret)]);
  contractAddress = contract.address();

  // Passes because right secret is provided
  txnParams.lsig = contract;
  await executeTransaction(deployer, txnParams);
}

module.exports = { default: run };
