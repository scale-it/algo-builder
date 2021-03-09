import { Runtime, StoreAccount, types } from '@algorand-builder/runtime';

import { getProgram } from '../../build';
const { assert } = require('chai');

const minBalance = 1000000n;
const masterBalance = 10000000n;
const amount = 1000000n;

describe('Sample Test', function () {
  let master = new StoreAccount(masterBalance);
  let fundReceiver = new StoreAccount(minBalance);

  let runtime;
  const approvalProgram = getProgram('fee-check.teal');

  this.beforeEach(async function () {
    master = new StoreAccount(masterBalance);
    fundReceiver = new StoreAccount(minBalance);

    runtime = new Runtime([master, fundReceiver]);
  });

  function syncAccounts () {
    master = runtime.getAccount(master.address);
    fundReceiver = runtime.getAccount(fundReceiver.address);
  }

  it('Should not fail because txn fees is equal to or greater than 10000 microAlgos', () => {
    const fees = 10000;
    syncAccounts();
    const lsig = runtime.getLogicSig(approvalProgram);
    lsig.sign(master.account.sk);
    runtime.executeTx({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      lsig: lsig,
      fromAccount: master.account,
      toAccountAddr: fundReceiver.address,
      amountMicroAlgos: amount,
      payFlags: { totalFee: fees }
    });
    syncAccounts();
    assert.deepEqual(fundReceiver.balance(), minBalance + amount);
    assert.deepEqual(master.balance(), masterBalance - amount - BigInt(fees));
  });

  it('Should fail because txn fees is less than 10000 microAlgos', () => {
    const fees = 1000;
    syncAccounts();
    const lsig = runtime.getLogicSig(approvalProgram);
    lsig.sign(master.account.sk);
    console.log('Expected to be failed by logic');
    try {
      runtime.executeTx({
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        lsig: lsig,
        fromAccount: master.account,
        toAccountAddr: fundReceiver.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fees }
      });
    } catch (error) {
      console.log(error);
    }
    syncAccounts();
    assert.notEqual(fundReceiver.balance(), minBalance + amount);
    assert.notEqual(master.balance(), masterBalance - amount - BigInt(fees));
  });
});
