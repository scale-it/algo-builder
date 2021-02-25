import {
  addressToPk,
  getProgram,
  stringToBytes,
  uint64ToBigEndian
} from '@algorand-builder/algob';
import { Runtime, StoreAccount, types } from '@algorand-builder/runtime';
import { assert } from 'chai';

const minBalance = 10e6; // 10 ALGO's
const initialDonorBalance = minBalance + 60e6;
const initialCreatorBalance = minBalance + 0.01e6;
const goal = 7e6;

describe('Crowdfunding Test - Failing Scenarios', function () {
  const master = new StoreAccount(1000e6);
  let creator = new StoreAccount(initialCreatorBalance);
  let escrow;
  let donor = new StoreAccount(initialDonorBalance);

  let runtime;
  let applicationId;
  let appArgs;
  let beginDate;
  let endDate;
  let fundCloseDate;
  let donateTxGroup;
  let lsig;
  let escrowAddress;
  const rejectMsg = 'RUNTIME_ERR1007: Teal code rejected by logic';
  const approvalProgram = getProgram('crowdFundApproval.teal');
  const clearProgram = getProgram('crowdFundClear.teal');

  // Create new runtime and application before each test.
  this.beforeEach(() => {
    runtime = new Runtime([master, creator, donor]);

    // Get begin date to pass in
    beginDate = new Date();
    beginDate.setSeconds(beginDate.getSeconds() + 2);

    // Get end date to pass in
    endDate = new Date();
    endDate.setSeconds(endDate.getSeconds() + 12000);

    // Get fund close date to pass in
    fundCloseDate = new Date();
    fundCloseDate.setSeconds(fundCloseDate.getSeconds() + 120000);

    // set timestamp
    runtime.setRoundAndTimestamp(5, beginDate.getTime() + 100);

    const creationArgs = [
      uint64ToBigEndian(beginDate.getTime()),
      uint64ToBigEndian(endDate.getTime()),
      `int:${goal}`, // args similar to `goal --app-arg ..` are also supported
      addressToPk(creator.address),
      uint64ToBigEndian(fundCloseDate.getTime())
    ];
    const creationFlags = {
      sender: creator.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3
    };

    // create application
    applicationId = runtime.addApp(
      { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);

    // setup escrow account
    const escrowProg = getProgram('crowdFundEscrow.py', { APP_ID: applicationId });
    lsig = runtime.getLogicSig(escrowProg, []);
    escrowAddress = lsig.address();

    // sync escrow account
    escrow = runtime.getAccount(escrowAddress);
    console.log('Escrow Address: ', escrowAddress);

    // fund escrow with some minimum balance first
    runtime.executeTx({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: escrowAddress,
      amountMicroAlgos: minBalance,
      payFlags: {}
    });

    appArgs = [stringToBytes('donate')];
    donateTxGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: goal - 1e6,
        payFlags: { totalFee: 1000 }
      }
    ];
  });

  function updateAndOptIn () {
    // update application with correct escrow account address
    appArgs = [addressToPk(escrowAddress)]; // converts algorand address to Uint8Array

    runtime.updateApp(
      creator.address,
      applicationId,
      approvalProgram,
      clearProgram,
      {}, { appArgs: appArgs });

    // opt-in to app
    runtime.optInToApp(creator.address, applicationId, {}, {});
    runtime.optInToApp(donor.address, applicationId, {}, {});
  }

  this.afterEach(async function () {
    creator = new StoreAccount(initialCreatorBalance);
    donor = new StoreAccount(initialDonorBalance);
    runtime = new Runtime([master, creator, escrow, donor]);
  });

  it('should fail donation if donor has insufficient balance', () => {
    updateAndOptIn();
    appArgs = [stringToBytes('donate')];
    const donationAmount = initialDonorBalance + 1000;
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: donationAmount,
        payFlags: { totalFee: 1000 }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), 'RUNTIME_ERR1401: Cannot withdraw');
  });

  it('should fail donation if timestamp is after endDate', () => {
    updateAndOptIn();
    // set timestamp to after of endDate
    runtime.setRoundAndTimestamp(5, endDate.getSeconds() + 100);

    assert.throws(() => runtime.executeTx(donateTxGroup), rejectMsg);
  });

  it('should fail donation if timestamp is before of beginDate', () => {
    updateAndOptIn();
    // set timestamp to out of endDate
    runtime.setRoundAndTimestamp(5, beginDate.getSeconds() - 100);

    assert.throws(() => runtime.executeTx(donateTxGroup), rejectMsg);
  });

  it('should fail if goal is met, and donor tries to reclaim funds', () => {
    updateAndOptIn();
    // set donation to greater than goal
    donateTxGroup[1].amountMicroAlgos = goal + 1000;
    runtime.executeTx(donateTxGroup);
    runtime.setRoundAndTimestamp(5, endDate.getTime() + 100); // end date is passed

    appArgs = [stringToBytes('reclaim')];
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs,
        accounts: [escrow.address] //  AppAccounts
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: donor.address,
        amountMicroAlgos: 300000,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), rejectMsg);
  });

  it('should fail if goal is not met, but donor tries to reclaim funds before fund close date', () => {
    updateAndOptIn();
    runtime.executeTx(donateTxGroup);

    appArgs = [stringToBytes('reclaim')];
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs,
        accounts: [escrow.address] //  AppAccounts
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: donor.address,
        amountMicroAlgos: 300000,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), rejectMsg);
  });

  it('should fail if creator tries to claim funds before fund end date', () => {
    updateAndOptIn();
    // set donation to greater than goal
    donateTxGroup[1].amountMicroAlgos = goal + 1000;
    runtime.executeTx(donateTxGroup);
    appArgs = [stringToBytes('claim')];
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: lsig,
        payFlags: { totalFee: 1000, closeRemainderTo: creator.address }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), rejectMsg);
  });

  it('should fail if a transaction is missing in group transaction while donating', () => {
    updateAndOptIn();
    appArgs = [stringToBytes('donate')];
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), 'RUNTIME_ERR1008: Index out of bound');
  });

  it('should fail if transaction is signed by wrong lsig', () => {
    updateAndOptIn();
    // set donation to greater than goal
    donateTxGroup[1].amountMicroAlgos = goal + 1000;
    runtime.executeTx(donateTxGroup);
    const escrowProg = getProgram('wrongEscrow.teal', { APP_ID: applicationId });
    const wrongLsig = runtime.getLogicSig(escrowProg, []);
    runtime.setRoundAndTimestamp(5, endDate.getTime() + 11);
    appArgs = [stringToBytes('claim')];
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: wrongLsig,
        payFlags: { totalFee: 1000, closeRemainderTo: creator.address }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), 'RUNTIME_ERR1301: logic signature validation failed.');
  });

  it('should fail if escrow address is not updated in app', () => {
    // opt-in to app
    runtime.optInToApp(creator.address, applicationId, {}, {});
    runtime.optInToApp(donor.address, applicationId, {}, {});

    // we get invalid type error because if we don't update escrow in global state,
    // it returns 0 value when compared with bytes array results in this error.
    assert.throws(() => runtime.executeTx(donateTxGroup), 'RUNTIME_ERR1003: Type of data is incorrect.');
  });

  it('should fail transaction if logic signature is not passed', () => {
    updateAndOptIn();
    // set donation to greater than goal
    donateTxGroup[1].amountMicroAlgos = goal + 1000;
    runtime.executeTx(donateTxGroup);
    runtime.setRoundAndTimestamp(5, endDate.getTime() + 11);
    appArgs = [stringToBytes('claim')];
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        payFlags: { totalFee: 1000, closeRemainderTo: creator.address }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), 'RUNTIME_ERR1300: logic signature not found');
  });

  it('should fail to delete app because escrow account balance is not empty', () => {
    updateAndOptIn();
    runtime.setRoundAndTimestamp(5, fundCloseDate.getTime() + 12);
    const deleteTx = {
      type: types.TransactionType.DeleteSSC,
      sign: types.SignType.SecretKey,
      fromAccount: creator.account,
      appId: applicationId,
      payFlags: { totalFee: 1000 },
      appArgs: [],
      accounts: [escrow.address] //  AppAccounts
    };

    assert.throws(() => runtime.executeTx(deleteTx), 'RUNTIME_ERR1008: Index out of bound');
  });

  it('should fail on trying to update application where sender is not creator', () => {
    appArgs = [addressToPk(escrowAddress)]; // converts algorand address to Uint8Array

    assert.throws(() =>
      runtime.updateApp(
        donor.address,
        applicationId,
        approvalProgram,
        clearProgram,
        {}, { appArgs: appArgs }
      ),
    rejectMsg
    );
  });

  it('should fail if closing the funds in escrow but closeRemainderTo is not fundReceiver', () => {
    updateAndOptIn();
    // set donation to greater than goal
    donateTxGroup[1].amountMicroAlgos = goal + 1000;
    runtime.executeTx(donateTxGroup);
    runtime.setRoundAndTimestamp(5, endDate.getTime() + 122);
    appArgs = [stringToBytes('claim')];
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: lsig,
        payFlags: { totalFee: 1000, closeRemainderTo: donor.address }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), rejectMsg);
  });

  // uncomment when
  // https://github.com/algorand/js-algorand-sdk/commit/b18e3beab8004d7e53a5370334b8e9f5c7699146#diff-75520b02c557ab3f0b89e5f03029db31af2f0dc79e5215d3e221ed9ea59fe441
  // commit is released
  /* it('should fail if ReKeyTo is not zeroAddress in transaction', () => {
    updateAndOptIn();
    // set donation to greater than goal
    donateTxGroup[1].amountMicroAlgos = goal + 1000;
    runtime.executeTx(donateTxGroup);
    runtime.setRoundAndTimestamp(5, endDate.getTime() + 122);
    appArgs = [stringToBytes('claim')];
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000, ReKeyTo: donor.address },
        appArgs: appArgs
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: lsig,
        payFlags: { totalFee: 1000, closeRemainderTo: creator.address, ReKeyTo: donor.address }
      }
    ];

    assert.throws(() => runtime.executeTx(txGroup), rejectMsg);
  }); */
});
