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

/**
 * NOTE: The following unit tests test the happy flow of the crowdfunding application.
 * - Each test is independent of each other
 * - We are testing each branch of TEAL code independently here.
 * eg. To test the "claim:" branch, we prepare the state using getLocalState, setGlobalState
 * functions in runtime, and set the state directly (to avoid calling the smart contract)
 * We only call the smart contract during the actual 'claim' tx call, and verify state later.
 */
describe('Crowdfunding Tests - Happy Paths', function () {
  const master = new StoreAccount(1000e6);
  let creator = new StoreAccount(initialCreatorBalance);
  let fundReceiver = new StoreAccount(minBalance);
  let donor = new StoreAccount(initialDonorBalance);
  let escrow, escrowLsig; // initialized later

  let runtime;
  let creationFlags;
  let applicationId;
  const approvalProgram = getProgram('crowdFundApproval.teal');
  const clearProgram = getProgram('crowdFundClear.teal');

  this.beforeAll(async function () {
    runtime = new Runtime([master, creator, donor]);

    creationFlags = {
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
    fundReceiver = runtime.getAccount(fundReceiver.address);
    escrow = runtime.getAccount(escrow.address);
  }

  /**
   * This function sets up the application and escrow account for crowdfunding
   * tests, without calling the smart contract (so that tests are independent of each other)
   */
  function setupAppAndEscrow () {
    // refresh accounts + initialize runtime
    creator = new StoreAccount(initialCreatorBalance);
    fundReceiver = new StoreAccount(minBalance);
    donor = new StoreAccount(initialDonorBalance);
    runtime = new Runtime([master, creator, donor, fundReceiver]);

    applicationId = 1;
    creator.addApp(applicationId, creationFlags, approvalProgram, clearProgram);
    runtime.store.globalApps.set(applicationId, creator.address);

    // set creation args in global state
    creator.setGlobalState(applicationId, 'Creator', addressToPk(creator.address));
    creator.setGlobalState(applicationId, 'StartDate', 1n);
    creator.setGlobalState(applicationId, 'EndDate', 10n);
    creator.setGlobalState(applicationId, 'Goal', BigInt(goal));
    creator.setGlobalState(applicationId, 'Receiver', addressToPk(fundReceiver.address));
    creator.setGlobalState(applicationId, 'Total', 0n);
    creator.setGlobalState(applicationId, 'FundCloseDate', 20n);

    // setup and sync escrow account
    const escrowProg = getProgram('crowdFundEscrow.py', { APP_ID: applicationId });
    escrowLsig = runtime.getLogicSig(escrowProg, []);
    const escrowAddress = escrowLsig.address();
    escrow = runtime.getAccount(escrowAddress);

    // fund escrow with some minimum balance
    runtime.executeTx({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: escrowAddress,
      amountMicroAlgos: minBalance,
      payFlags: {}
    });
  }

  it('should create crowdfunding stateful application', () => {
    const beginTs = 1n; // fund begin timestamp
    const endTs = 10n; // fund end timestamp
    const fundCloseTs = 20n; // fund close timestamp
    const fundReceiverPk = addressToPk(fundReceiver.address);

    const creationArgs = [
      uint64ToBigEndian(beginTs),
      uint64ToBigEndian(endTs),
      `int:${goal}`, // args similar to `goal --app-arg ..` are also supported
      fundReceiverPk,
      uint64ToBigEndian(fundCloseTs)
    ];

    // create application
    applicationId = runtime.addApp(
      { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);
    const creatorPk = addressToPk(creator.address);

    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('Creator'), creatorPk);
    assert.deepEqual(getGlobal('StartDate'), beginTs);
    assert.deepEqual(getGlobal('EndDate'), endTs);
    assert.deepEqual(getGlobal('Goal'), 7000000n);
    assert.deepEqual(getGlobal('Receiver'), fundReceiverPk);
    assert.deepEqual(getGlobal('Total'), 0n);
    assert.deepEqual(getGlobal('FundCloseDate'), 20n);
  });

  it('should setup escrow account and update application with escrow address', () => {
    setupAppAndEscrow();

    const escrowPk = addressToPk(escrow.address);
    runtime.updateApp(
      creator.address,
      applicationId,
      approvalProgram,
      clearProgram,
      {}, {
        appArgs: [escrowPk]
      });
    syncAccounts();

    // verify escrow storage
    assert.deepEqual(getGlobal('Escrow'), escrowPk);
  });

  it('should opt-in to app successfully after setting up escrow', () => {
    setupAppAndEscrow();

    // update global storage to add escrow address
    const escrowPk = addressToPk(escrow.address);
    creator.setGlobalState(applicationId, 'Escrow', escrowPk);

    runtime.optInToApp(creator.address, applicationId, {}, {});
    runtime.optInToApp(donor.address, applicationId, {}, {});
    syncAccounts();

    // verify opt-in
    assert.isDefined(creator.getAppFromLocal(applicationId));
    assert.isDefined(donor.getAppFromLocal(applicationId));
  });

  it('should be able to donate funds to escrow before end date', () => {
    setupAppAndEscrow();
    runtime.setRoundAndTimestamp(2, 5); // StartTs=1, EndTs=10

    // update global storage to add escrow address
    const escrowPk = addressToPk(escrow.address);
    runtime.getAccount(creator.address).setGlobalState(applicationId, 'Escrow', escrowPk);
    syncAccounts();

    // opt-in to app
    creator.optInToApp(applicationId, runtime.getApp(applicationId));
    donor.optInToApp(applicationId, runtime.getApp(applicationId));
    syncAccounts();

    // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
    const donorBal = donor.balance();
    const escrowBal = escrow.balance();
    const donateTxGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: [stringToBytes('donate')]
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: 7000000,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(donateTxGroup);

    syncAccounts();
    assert.equal(escrow.balance(), escrowBal + BigInt(7e6)); // verify donation of 7000000
    assert.equal(donor.balance(), donorBal - BigInt(7e6) - 2000n); // 2000 is also deducted because of tx fee
  });

  it('Receiver should be able to withdraw funds if Goal is met', () => {
    setupAppAndEscrow();
    // fund end date should be passed
    runtime.setRoundAndTimestamp(2, 15); // StartTs=1, EndTs=10
    runtime.getAccount(creator.address).setGlobalState(applicationId, 'Escrow', addressToPk(escrow.address));
    syncAccounts();

    creator.optInToApp(applicationId, runtime.getApp(applicationId));
    donor.optInToApp(applicationId, runtime.getApp(applicationId));
    syncAccounts();

    // fund escrow with amount = goal
    runtime.executeTx({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: donor.account,
      toAccountAddr: escrow.address,
      amountMicroAlgos: goal,
      payFlags: {}
    });

    // update Global State
    runtime.getAccount(creator.address).setGlobalState(applicationId, 'Total', BigInt(goal));
    syncAccounts();

    // transaction to claim/withdraw funds from escrow
    const fundReceiverBal = fundReceiver.balance(); // fund receiver's balance before 'claim' tx
    const escrowFunds = escrow.balance(); //  funds in escrow
    const claimTxGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: [stringToBytes('claim')]
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: fundReceiver.address,
        amountMicroAlgos: 0,
        lsig: escrowLsig, // initialized in setUpApp
        payFlags: { totalFee: 1000, closeRemainderTo: fundReceiver.address }
      }
    ];
    runtime.executeTx(claimTxGroup);

    syncAccounts();
    assert.equal(escrow.balance(), 0); // escrow should be empty after claim
    assert.equal(fundReceiver.balance(), fundReceiverBal + escrowFunds - 1000n); // funds transferred to receiver from escrow
  });

  it('Donor should be able reclaim funds if Goal is not met', () => {
    setupAppAndEscrow();
    // fund end date should be passed
    runtime.setRoundAndTimestamp(2, 15); // StartTs=1, EndTs=10
    runtime.getAccount(creator.address).setGlobalState(applicationId, 'Escrow', addressToPk(escrow.address));
    syncAccounts();

    creator.optInToApp(applicationId, runtime.getApp(applicationId));
    donor.optInToApp(applicationId, runtime.getApp(applicationId));
    syncAccounts();

    // fund escrow with amount < goal
    runtime.executeTx({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: donor.account,
      toAccountAddr: escrow.address,
      amountMicroAlgos: goal - 1e6,
      payFlags: {}
    });
    syncAccounts();

    // update Global State
    creator.setGlobalState(applicationId, 'Total', BigInt(goal - 1e6));
    donor.setLocalState(applicationId, 'MyAmountGiven', BigInt(goal - 1e6));
    syncAccounts();

    // reclaim transaction
    const reclaimTxGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: donor.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: [stringToBytes('reclaim')],
        accounts: [escrow.address] //  AppAccounts
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: donor.address,
        amountMicroAlgos: 300000,
        lsig: escrowLsig,
        payFlags: { totalFee: 1000 }
      }
    ];
    const donorBalance = donor.balance();
    const escrowBalance = escrow.balance();
    runtime.executeTx(reclaimTxGroup);

    syncAccounts();
    // verify 300000 is withdrawn from escrow (with tx fee of 1000 as well)
    assert.equal(escrow.balance(), escrowBalance - 300000n - 1000n);
    assert.equal(donor.balance(), donorBalance + 300000n - 1000n);
  });

  it('Creator should be able to delete the application after the fund close date (using single tx)', () => {
    setupAppAndEscrow();
    // fund close date should be passed
    runtime.setRoundAndTimestamp(2, 25); // fundCloseTs=20n
    runtime.getAccount(creator.address).setGlobalState(applicationId, 'Escrow', addressToPk(escrow.address));
    syncAccounts();

    creator.optInToApp(applicationId, runtime.getApp(applicationId));
    donor.optInToApp(applicationId, runtime.getApp(applicationId));
    syncAccounts();

    // let's close escrow account first
    runtime.executeTx({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: escrow.account,
      toAccountAddr: fundReceiver.address,
      amountMicroAlgos: 0,
      payFlags: { totalFee: 1000, closeRemainderTo: fundReceiver.address }
    });
    syncAccounts();

    // escrow is already empty so we don't need a tx group
    const deleteTx = {
      type: types.TransactionType.DeleteSSC,
      sign: types.SignType.SecretKey,
      fromAccount: creator.account,
      appId: applicationId,
      payFlags: { totalFee: 1000 },
      appArgs: [],
      accounts: [escrow.address] //  AppAccounts
    };

    // verify app is present before delete
    const app = runtime.getApp(applicationId);
    assert.isDefined(app);

    runtime.executeTx(deleteTx);

    // app should be deleted now
    try {
      runtime.getApp(applicationId);
    } catch (error) {
      console.log('[Expected: app does not exist] ', error.message);
    }
  });

  it('Creator should be able to delete the application after the fund close date (using group tx)', () => {
    setupAppAndEscrow();
    // fund close date should be passed
    runtime.setRoundAndTimestamp(2, 25); // fundCloseTs=20n
    runtime.getAccount(creator.address).setGlobalState(applicationId, 'Escrow', addressToPk(escrow.address));
    syncAccounts();

    creator.optInToApp(applicationId, runtime.getApp(applicationId));
    donor.optInToApp(applicationId, runtime.getApp(applicationId));
    syncAccounts();

    // here escrow still has some funds (minBalance), so this must be a group tx
    // where in the second tx, we empty the escrow account to receiver using closeRemainderTo
    const deleteTxGroup = [
      {
        type: types.TransactionType.DeleteSSC,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: [],
        accounts: [escrow.address] //  AppAccounts
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccount: escrow.account,
        toAccountAddr: donor.address,
        amountMicroAlgos: 0,
        lsig: escrowLsig,
        payFlags: { totalFee: 1000, closeRemainderTo: fundReceiver.address }
      }
    ];
    // verify app is present before delete
    const app = runtime.getApp(applicationId);
    assert.isDefined(app);

    runtime.executeTx(deleteTxGroup);

    // app should be deleted now
    try {
      runtime.getApp(applicationId);
    } catch (error) {
      console.log('[Expected: app does not exist] ', error.message);
    }
  });
});
