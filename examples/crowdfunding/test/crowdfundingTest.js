import {
  addressToBytes,
  getProgram,
  intToBigEndian,
  SignType,
  stringToBytes,
  TransactionType
} from '@algorand-builder/algob';
import { Runtime, StoreAccountImpl } from '@algorand-builder/algorand-js/build/src/index';
import { assert } from 'chai';

import { getAcc } from './common';

const initialDonorBalance = 60000000;
const initialCreatorBalance = 10000;
const goal = 7000000;

describe('Crowdfunding Tests', function () {
  let creatorAccount = new StoreAccountImpl(initialCreatorBalance);
  let escrowAccount = new StoreAccountImpl(0);
  let donorAccount = new StoreAccountImpl(initialDonorBalance);

  let runtime;
  let program;
  let flags;
  let applicationId;
  this.beforeAll(async function () {
    runtime = new Runtime([creatorAccount, escrowAccount, donorAccount]);
    program = getProgram('crowdFundApproval.teal');

    flags = {
      sender: creatorAccount.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3
    };
  });

  // update account state
  function syncAccounts () {
    creatorAccount = getAcc(runtime, creatorAccount);
    escrowAccount = getAcc(runtime, escrowAccount);
    donorAccount = getAcc(runtime, donorAccount);
  }

  it('should create crowdfunding application with correct global states', async () => {
    const creationFlags = Object.assign({}, flags);

    // Get begin date to pass in
    const beginDate = new Date();
    beginDate.setSeconds(beginDate.getSeconds() + 2);

    // Get end date to pass in
    const endDate = new Date();
    endDate.setSeconds(endDate.getSeconds() + 12000);

    // Get fund close date to pass in
    const fundCloseDate = new Date();
    fundCloseDate.setSeconds(fundCloseDate.getSeconds() + 120000);

    const appArgs = [
      intToBigEndian(beginDate.getTime()),
      intToBigEndian(endDate.getTime()),
      intToBigEndian(goal),
      addressToBytes(creatorAccount.address),
      intToBigEndian(fundCloseDate.getTime())
    ];

    const appId = await runtime.addApp({ ...creationFlags, appArgs: appArgs }, {}, program);
    applicationId = appId;
    const creatorPk = addressToBytes(creatorAccount.address);

    // verify global state
    assert.isDefined(appId);
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Creator')), creatorPk);
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('StartDate')), BigInt(beginDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('EndDate')), BigInt(endDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Goal')), BigInt(7000000));
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Receiver')), creatorPk);
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Total')), BigInt(0));
  });

  it('should update application with correct escrow account address', async () => {
    const appArgs = [addressToBytes(escrowAccount.address)];

    await runtime.updateApp(
      creatorAccount.account.addr,
      applicationId,
      program,
      {}, { appArgs: appArgs });
    const escrowPk = addressToBytes(escrowAccount.address);

    // verify escrow storage
    assert.isDefined(applicationId);
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('Escrow')), escrowPk);
  });

  it('should opt-in to app', async () => {
    await runtime.optInToApp(creatorAccount.address, applicationId, {}, {}, program);
    await runtime.optInToApp(donorAccount.address, applicationId, {}, {}, program);

    syncAccounts();
    assert.isDefined(creatorAccount.appsLocalState.find(app => app.id === applicationId));
    assert.isDefined(donorAccount.appsLocalState.find(app => app.id === applicationId));
  });

  it('should donate correct amount to escrow account', async () => {
    // App argument to donate.
    const appArgs = [stringToBytes('donate')];
    const donationAmount = 600000;

    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donorAccount.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: donorAccount.account,
        toAccountAddr: escrowAccount.address,
        amountMicroAlgos: donationAmount,
        payFlags: {}
      }
    ];
    // execute transaction
    await runtime.executeTx(txGroup, program, []);

    syncAccounts();
    assert.equal(escrowAccount.balance(), donationAmount);
    assert.equal(donorAccount.balance(), initialDonorBalance - donationAmount);
  });

  it('should not be able to claim funds because goal is not reached', async () => {
    const appArgs = [stringToBytes('claim')];
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creatorAccount.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: { addr: escrowAccount.address },
        toAccountAddr: creatorAccount.address,
        amountMicroAlgos: 0,
        lsig: escrowAccount,
        payFlags: { closeRemainderTo: creatorAccount.address }
      }
    ];
    // execute transaction: Expected to be rejected by logic
    try {
      await runtime.executeTx(txGroup, program, []);
    } catch (e) {
      console.warn(e);
    }
  });

  it('donor should be able to reclaim if goal is not met', async () => {
    const appArgs = [stringToBytes('reclaim')];
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donorAccount.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs,
        accounts: [escrowAccount.address] //  AppAccounts
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: escrowAccount.account,
        toAccountAddr: donorAccount.address,
        amountMicroAlgos: 300000,
        lsig: escrowAccount,
        payFlags: {}
      }
    ];

    syncAccounts();
    const donorBalance = donorAccount.balance();
    await runtime.executeTx(txGroup, program, []);

    syncAccounts();
    assert.equal(escrowAccount.balance(), 300000);
    assert.equal(donorAccount.balance(), donorBalance + 300000);
  });

  it('should claim if goal is reached', async () => {
    let appArgs = [stringToBytes('donate')];
    const donationAmount = 7000000;

    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donorAccount.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: donorAccount.account,
        toAccountAddr: escrowAccount.address,
        amountMicroAlgos: donationAmount,
        payFlags: {}
      }
    ];
    // execute transaction
    await runtime.executeTx(txGroup, program, []);

    appArgs = [stringToBytes('claim')];
    txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creatorAccount.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: escrowAccount.account,
        toAccountAddr: creatorAccount.address,
        amountMicroAlgos: 0,
        lsig: escrowAccount,
        payFlags: { closeRemainderTo: creatorAccount.address }
      }
    ];
    await runtime.executeTx(txGroup, program, []);
    // TODO- close account and tranfer funds to closeRemainderTo
  });
});
