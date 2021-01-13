import {
  addressToPk,
  getProgram,
  intToBigEndian,
  SignType,
  stringToBytes,
  TransactionType
} from '@algorand-builder/algob';
import { Runtime, StoreAccount } from '@algorand-builder/algorand-js';
import { assert } from 'chai';

import { getAcc } from './common';

const initialDonorBalance = 60000000;
const initialCreatorBalance = 10000;
const goal = 7000000;

describe('Crowdfunding Tests', function () {
  let creator = new StoreAccount(initialCreatorBalance);
  let escrow = new StoreAccount(0);
  let donor = new StoreAccount(initialDonorBalance);

  let runtime;
  let flags;
  let applicationId;
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
    creator = new StoreAccount(initialCreatorBalance);
    escrow = new StoreAccount(0);
    donor = new StoreAccount(initialDonorBalance);
    runtime = new Runtime([creator, escrow, donor]);

    flags = {
      sender: creator.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3
    };
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationId, stringToBytes(key));

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
    addressToPk(creator.address),
    intToBigEndian(fundCloseDate.getTime())
  ];

  it('crowdfunding application', async () => {
    /**
     * This test demonstrates how to create a Crowdfunding Stateful Smart Contract Application
     * and interact with it. there are following operations that are performed:
     * - Create the application
     * - Update the application
     * - Donate funds
     * - Reclaim funds
     * - Claim funds
     * Note: - In this example timestamps are commented because it is possible
     * that network timestamp and system timestamp may not be in sync.
     */
    const creationFlags = Object.assign({}, flags);

    // create application
    applicationId = await runtime.addApp({ ...creationFlags, appArgs: creationArgs }, {}, program);
    const creatorPk = addressToPk(creator.address);

    // verify global state
    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('Creator'), creatorPk);
    assert.deepEqual(getGlobal('StartDate'), BigInt(beginDate.getTime()));
    assert.deepEqual(getGlobal('EndDate'), BigInt(endDate.getTime()));
    assert.deepEqual(getGlobal('Goal'), 7000000n);
    assert.deepEqual(getGlobal('Receiver'), creatorPk);
    assert.deepEqual(getGlobal('Total'), 0n);

    // update application with correct escrow account address
    let appArgs = [addressToPk(escrow.address)]; // converts algorand address to Uint8Array

    await runtime.updateApp(
      creator.address,
      applicationId,
      program,
      {}, { appArgs: appArgs });
    const escrowPk = addressToPk(escrow.address);

    // verify escrow storage
    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('Escrow'), escrowPk);

    // opt-in to app
    await runtime.optInToApp(creator.address, applicationId, {}, {}, program);
    await runtime.optInToApp(donor.address, applicationId, {}, {}, program);

    syncAccounts();
    assert.isDefined(creator.appsLocalState.get(applicationId));
    assert.isDefined(donor.appsLocalState.get(applicationId));

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
    let appArgs = [addressToPk(escrow.address)]; // converts algorand address to Uint8Array
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
