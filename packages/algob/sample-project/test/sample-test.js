import { getProgram } from '@algo-builder/algob';
import { Runtime, StoreAccount, types } from '@algo-builder/runtime';
const { assert } = require('chai');

const minBalance = BigInt(1e6);
const masterBalance = BigInt(10e6);
const amount = BigInt(1e6);

describe('Sample Test', function () {
  let master;
  let fundReceiver;

  let runtime;
  const feeCheckProgram = getProgram('fee-check.teal');

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
    assert.equal(fundReceiver.balance(), minBalance);
    assert.equal(master.balance(), masterBalance);
    const lsig = runtime.getLogicSig(feeCheckProgram);
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
    assert.equal(fundReceiver.balance(), minBalance + amount);
    assert.equal(master.balance(), masterBalance - amount - BigInt(fees));
  });

  it('Should fail because txn fees is less than 10000 microAlgos', () => {
    const fees = 1000;
    syncAccounts();
    const lsig = runtime.getLogicSig(feeCheckProgram);
    lsig.sign(master.account.sk);
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
    assert.equal(fundReceiver.balance(), minBalance);
    assert.equal(master.balance(), masterBalance);
    assert.notEqual(fundReceiver.balance(), minBalance + amount);
    assert.notEqual(master.balance(), masterBalance - amount - BigInt(fees));
  });
});
