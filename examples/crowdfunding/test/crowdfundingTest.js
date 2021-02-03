import {
  addressToPk,
  getProgram,
  stringToBytes,
  uint64ToBigEndian
} from '@algorand-builder/algob';
import { Runtime, StoreAccount } from '@algorand-builder/runtime';
import { SignType, TransactionType } from '@algorand-builder/runtime/build/types';
import { assert } from 'chai';

const minBalance = 10e6; // 10 ALGO's
const initialDonorBalance = minBalance + 60e6;
const initialCreatorBalance = minBalance + 0.01e6;
const goal = 7e6;

describe('Crowdfunding Tests', function () {
  const master = new StoreAccount(1000e6);
  let creator = new StoreAccount(initialCreatorBalance);
  let escrow = new StoreAccount(minBalance);
  let donor = new StoreAccount(initialDonorBalance);

  let runtime;
  let flags;
  let applicationId;
  const program = getProgram('crowdFundApproval.teal');

  this.beforeAll(async function () {
    runtime = new Runtime([master, creator, escrow, donor]);

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
    donor = new StoreAccount(initialDonorBalance);
    runtime = new Runtime([master, creator, escrow, donor]);

    flags = {
      sender: creator.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3
    };
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationId, key);

  // fetch latest account state
  function syncAccounts () {
    creator = runtime.getAccount(creator.address);
    donor = runtime.getAccount(donor.address);
    escrow = runtime.getAccount(escrow.address);
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
    uint64ToBigEndian(beginDate.getTime()),
    uint64ToBigEndian(endDate.getTime()),
    `int:${goal}`, // args similar to `goal --app-arg ..` are also supported
    addressToPk(creator.address),
    uint64ToBigEndian(fundCloseDate.getTime())
  ];

  it('crowdfunding application', () => {
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
    applicationId = runtime.addApp({ ...creationFlags, appArgs: creationArgs }, {}, program);
    const creatorPk = addressToPk(creator.address);

    // setup escrow account
    const escrowProg = getProgram('crowdFundEscrow.py', { APP_ID: applicationId });
    const lsig = runtime.getLogicSig(escrowProg, []);
    const escrowAddress = lsig.address();

    // sync escrow account
    escrow = runtime.getAccount(escrowAddress);
    console.log('Escrow Address: ', escrowAddress);

    // fund escrow with some minimum balance first
    runtime.transferAlgo({
      type: TransactionType.TransferAlgo,
      sign: SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: escrowAddress,
      amountMicroAlgos: minBalance,
      payFlags: {}
    });

    // verify global state
    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('Creator'), creatorPk);
    assert.deepEqual(getGlobal('StartDate'), BigInt(beginDate.getTime()));
    assert.deepEqual(getGlobal('EndDate'), BigInt(endDate.getTime()));
    assert.deepEqual(getGlobal('Goal'), 7000000n);
    assert.deepEqual(getGlobal('Receiver'), creatorPk);
    assert.deepEqual(getGlobal('Total'), 0n);

    // update application with correct escrow account address
    let appArgs = [addressToPk(escrowAddress)]; // converts algorand address to Uint8Array

    runtime.updateApp(
      creator.address,
      applicationId,
      program,
      {}, { appArgs: appArgs });
    const escrowPk = addressToPk(escrowAddress);

    // verify escrow storage
    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('Escrow'), escrowPk);

    // opt-in to app
    runtime.optInToApp(creator.address, applicationId, {}, {}, program);
    runtime.optInToApp(donor.address, applicationId, {}, {}, program);

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
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: donationAmount,
        payFlags: { totalFee: 1000 }
      }
    ];
    runtime.executeTx(txGroup, program, []);

    // sync accounts
    syncAccounts();
    assert.equal(escrow.balance(), minBalance + donationAmount);
    assert.equal(donor.balance(), initialDonorBalance - donationAmount - 2000); // 2000 because of tx fee

    // donor should be able to reclaim if goal is NOT met
    appArgs = [stringToBytes('reclaim')];
    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs,
        accounts: [escrow.address] //  AppAccounts
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: donor.address,
        amountMicroAlgos: 300000,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      }
    ];

    syncAccounts();
    const donorBalance = donor.balance();
    const escrowBalance = escrow.balance();
    runtime.executeTx(txGroup, program, []);

    syncAccounts();
    // verify 300000 is withdrawn from escrow (with tx fee of 1000 as well)
    assert.equal(escrow.balance(), escrowBalance - 300000 - 1000);
    assert.equal(donor.balance(), donorBalance + 300000 - 1000);

    // should claim if goal is reached'
    appArgs = [stringToBytes('donate')];

    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: donor.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: 7000000,
        payFlags: { totalFee: 1000 }
      }
    ];
    const escrowBal = escrow.balance();
    runtime.executeTx(txGroup, program, []);

    syncAccounts();
    assert.equal(escrow.balance(), escrowBal + 7000000); // verify donation of 7000000

    appArgs = [stringToBytes('claim')];
    txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: appArgs
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: lsig,
        payFlags: { totalFee: 1000, closeRemainderTo: creator.address }
      }
    ];
    const creatorBal = creator.balance(); // creator's balance before 'claim' tx
    const escrowFunds = escrow.balance(); //  funds in escrow
    runtime.executeTx(txGroup, program, []);

    syncAccounts();
    assert.equal(escrow.balance(), 0); // escrow should be empty after claim
    assert.equal(creator.balance(), creatorBal + escrowFunds - 2000); // funds transferred to creator from escrow

    // after claiming, creator of the crowdfunding application should be able to delete the application
    // NOTE: we don't need a txGroup here as escrow is already empty
    const deleteTx = {
      type: TransactionType.DeleteSSC,
      sign: SignType.SecretKey,
      fromAccount: creator.account,
      appId: applicationId,
      payFlags: { totalFee: 1000 },
      appArgs: [],
      accounts: [escrow.address] //  AppAccounts
    };

    const app = runtime.getApp(applicationId);
    assert.isDefined(app); // verify app is present before delete tx

    runtime.executeTx(deleteTx, program, []);

    // should throw error as app is deleted
    try {
      runtime.getApp(applicationId);
    } catch (e) {
      console.log(e.message); // app not found.
    }
  });

  it('should be rejected by logic when claiming funds if goal is not met', () => {
    // create application
    const creationFlags = Object.assign({}, flags);
    const applicationId = runtime.addApp({ ...creationFlags, appArgs: creationArgs }, {}, program);

    // setup escrow account
    const escrowProg = getProgram('crowdFundEscrow.py', { APP_ID: applicationId });
    const lsig = runtime.getLogicSig(escrowProg, []);
    const escrowAddress = lsig.address();

    // sync escrow account
    escrow = runtime.getAccount(escrowAddress);
    console.log('Escrow Address: ', escrowAddress);
    syncAccounts();

    // update application with correct escrow account address
    let appArgs = [addressToPk(escrowAddress)]; // converts algorand address to Uint8Array
    runtime.updateApp(
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
        fromAccount: escrow.account,
        toAccountAddr: creator.address,
        amountMicroAlgos: 0,
        lsig: lsig,
        payFlags: { closeRemainderTo: creator.address }
      }
    ];
    // execute transaction: Expected to be rejected by logic because goal is not reached
    try {
      runtime.executeTx(txGroup, program, []);
    } catch (e) {
      console.warn(e);
    }
  });
});
