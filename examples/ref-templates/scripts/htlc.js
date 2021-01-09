const { executeTransaction, mkTxnParams } = require('./common/common');
const { SignType, globalZeroAddress, stringToBytes } = require('@algorand-builder/algob');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const john = deployer.accountsByName.get('john');

  const txnParams = mkTxnParams(masterAccount, john.addr, 4e6, {}, { note: 'funding account' });
  txnParams.sign = SignType.SecretKey;
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
  txnParams.sign = SignType.LogicSignature;
  txnParams.toAccountAddr = globalZeroAddress;
  txnParams.amountMicroAlgos = 0;
  txnParams.lsig = contract;
  txnParams.payFlags = { totalFee: 1000, closeRemainderTo: john.addr };
  // Fails because wrong secret is passed
  await executeTransaction(deployer, txnParams);

  contract = await deployer.loadLogic('htlc.py', [stringToBytes(secret)]);
  contractAddress = contract.address();

  // Passes because right secret is passed
  txnParams.lsig = contract;
  await executeTransaction(deployer, txnParams);
}

module.exports = { default: run };
