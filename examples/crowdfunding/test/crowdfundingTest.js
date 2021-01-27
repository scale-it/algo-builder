import {
  addressToPk,
  getProgram,
  SignType,
  stringToBytes,
  TransactionType,
  uint64ToBigEndian
} from '@algorand-builder/algob';
import { Runtime, StoreAccount } from '@algorand-builder/runtime';
import { assert } from 'chai';

const initialDonorBalance = 60e6;
const initialCreatorBalance = 1e4;
const goal = 7e6;

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
    runtime.executeTx(txGroup, program, []);

    // sync accounts
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
        lsig: lsig,
        payFlags: {}
      }
    ];

    syncAccounts();
    const donorBalance = donor.balance();
    runtime.executeTx(txGroup, program, []);

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
    runtime.executeTx(txGroup, program, []);

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
        lsig: lsig,
        payFlags: { closeRemainderTo: creator.address }
      }
    ];
    runtime.executeTx(txGroup, program, []);
    // TODO- close account and tranfer funds to closeRemainderTo in runtime
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
