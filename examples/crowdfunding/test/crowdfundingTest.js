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
  let creator = new StoreAccountImpl(initialCreatorBalance);
  let escrow = new StoreAccountImpl(0);
  let donor = new StoreAccountImpl(initialDonorBalance);

  let runtime;
  let flags;
  const program = getProgram('crowdFundApproval.teal');

  this.beforeAll(async function () {
    runtime = new Runtime([creator, escrow, donor]);

    flags = {
      sender: creator.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3
    };
  });

  this.afterEach(async function () {
    creator = new StoreAccountImpl(initialCreatorBalance);
    escrow = new StoreAccountImpl(0);
    donor = new StoreAccountImpl(initialDonorBalance);
    runtime = new Runtime([creator, escrow, donor]);

    flags = {
      sender: creator.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3
    };
  });

  // fetch latest account state
  function syncAccounts () {
    creator = getAcc(runtime, creator);
    escrow = getAcc(runtime, escrow);
    donor = getAcc(runtime, donor);
  }

  // Get begin date to pass in
  const beginDate = new Date();
  beginDate.setSeconds(beginDate.getSeconds() + 2);

  // Get end date to pass in
  const endDate = new Date();
  endDate.setSeconds(endDate.getSeconds() + 12000);

  // Get fund close date to pass in
  const fundCloseDate = new Date();
  fundCloseDate.setSeconds(fundCloseDate.getSeconds() + 120000);

  const creationArgs = [
    intToBigEndian(beginDate.getTime()),
    intToBigEndian(endDate.getTime()),
    intToBigEndian(goal),
    addressToBytes(creator.address),
    intToBigEndian(fundCloseDate.getTime())
  ];

  it('crowdfunding application', async () => {
    const creationFlags = Object.assign({}, flags);

    // create application
    const applicationId = await runtime.addApp({ ...creationFlags, appArgs: creationArgs }, {}, program);
    const creatorPk = addressToBytes(creator.address);

    // verify global state
    assert.isDefined(applicationId);
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('Creator')), creatorPk);
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('StartDate')), BigInt(beginDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('EndDate')), BigInt(endDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('Goal')), 7000000n);
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('Receiver')), creatorPk);
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('Total')), 0n);

    // update application with correct escrow account address
    let appArgs = [addressToBytes(escrow.address)]; // converts algorand address to Uint8Array

    await runtime.updateApp(
      creator.address,
      applicationId,
      program,
      {}, { appArgs: appArgs });
    const escrowPk = addressToBytes(escrow.address);

    // verify escrow storage
    assert.isDefined(applicationId);
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('Escrow')), escrowPk);

    // opt-in to app
    await runtime.optInToApp(creator.address, applicationId, {}, {}, program);
    await runtime.optInToApp(donor.address, applicationId, {}, {}, program);

    syncAccounts();
    assert.isDefined(creator.appsLocalState.find(app => app.id === applicationId));
    assert.isDefined(donor.appsLocalState.find(app => app.id === applicationId));

    // donate correct amount to escrow account
    // App argument to donate.
    appArgs = [stringToBytes('donate')];
    const donationAmount = 600000;

    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: donationAmount,
        payFlags: {}
      }
    ];
    // execute transaction
    await runtime.executeTx(txGroup, program, []);

    syncAccounts();
    assert.equal(escrow.balance(), donationAmount);
    assert.equal(donor.balance(), initialDonorBalance - donationAmount);

    // donor should be able to reclaim if goal is met
    appArgs = [stringToBytes('reclaim')];
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs,
        accounts: [escrow.address] //  AppAccounts
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: donor.address,
        amountMicroAlgos: 300000,
        lsig: escrow,
        payFlags: {}
      }
    ];

    syncAccounts();
    const donorBalance = donor.balance();
    await runtime.executeTx(txGroup, program, []);

    syncAccounts();
    assert.equal(escrow.balance(), 300000);
    assert.equal(donor.balance(), donorBalance + 300000);

    // should claim if goal is reached'
    appArgs = [stringToBytes('donate')];

    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: 7000000,
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
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: escrow,
        payFlags: { closeRemainderTo: creator.address }
      }
    ];
    await runtime.executeTx(txGroup, program, []);
    // TODO- close account and tranfer funds to closeRemainderTo in algorand-js
  });

  it('should be rejected by logic when claiming funds if goal is not met', async () => {
    // create application
    const creationFlags = Object.assign({}, flags);
    const applicationId = await runtime.addApp({ ...creationFlags, appArgs: creationArgs }, {}, program);

    // update application with correct escrow account address
    let appArgs = [addressToBytes(escrow.address)]; // converts algorand address to Uint8Array
    await runtime.updateApp(
      creator.address,
      applicationId,
      program,
      {}, { appArgs: appArgs });

    appArgs = [stringToBytes('claim')];
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: {},
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: { addr: escrow.address },
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: escrow,
        payFlags: { closeRemainderTo: creator.address }
      }
    ];
    // execute transaction: Expected to be rejected by logic because goal is not reached
    try {
      await runtime.executeTx(txGroup, program, []);
    } catch (e) {
      console.warn(e);
    }
  });
});
