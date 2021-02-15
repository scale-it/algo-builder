import {
  addressToPk,
  getProgram,
  stringToBytes,
  uint64ToBigEndian
} from '@algorand-builder/algob';
import { Runtime, StoreAccount, types } from '@algorand-builder/runtime';
import { assert } from 'chai';

const minBalance = 10e6; // 10 ALGO's

describe('Test for transferring asset using custom logic', function () {
  const master = new StoreAccount(1000e6);
  let alice = new StoreAccount(minBalance);
	let bob = new StoreAccount(minBalance);
  let escrow; // initialized later (using runtime.getLogicSig)

  let runtime;
  let flags;
  let applicationId;
	let assetId;
  const approvalProgram = getProgram('poi-approval.teal');
  const clearProgram = getProgram('poi-clear.teal');

  this.beforeAll(async function () {
    runtime = new Runtime([master, alice, bob]);

    flags = {
      sender: alice.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 1,
    };
  });

  this.afterEach(async function () {
		let alice = new StoreAccount(minBalance);
		let bob = new StoreAccount(minBalance);
    runtime = new Runtime([master, alice, bob]);

    flags = {
      sender: alice.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 1,
    };
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationId, key);

  // fetch latest account state
  function syncAccounts () {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    escrow = runtime.getAccount(escrow.address);
  }

  it('should transfer 1000 Assets from Alice to Bob according to custom logic', () => {
    /**
     * This test demonstrates how to transfer assets from account A to B using custom logic
		 * based on a smart contract. Asset is actually transferred by the clawback address (an escrow
		 * account in this case). Following operations are performed
     * - Create the asset + optIn
     * - Create the application + optIn
     */

		assetId = runtime.createAsset('gold', { creator: { ...alice.account, name: "alice" } });
		console.log('AAA:: :', assetId);

    // const creationFlags = Object.assign({}, flags);

    // // create application
    // applicationId = runtime.addApp(
    //   { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);
    // const creatorPk = addressToPk(creator.address);

    // // setup escrow account
    // const escrowProg = getProgram('crowdFundEscrow.py', { APP_ID: applicationId });
    // const lsig = runtime.getLogicSig(escrowProg, []);
    // const escrowAddress = lsig.address();

    // // sync escrow account
    // escrow = runtime.getAccount(escrowAddress);
    // console.log('Escrow Address: ', escrowAddress);

    // // fund escrow with some minimum balance first
    // runtime.transferAlgo({
    //   type: types.TransactionType.TransferAlgo,
    //   sign: types.SignType.SecretKey,
    //   fromAccount: master.account,
    //   toAccountAddr: escrowAddress,
    //   amountMicroAlgos: minBalance,
    //   payFlags: {}
    // });

    // // verify global state
    // assert.isDefined(applicationId);
    // assert.deepEqual(getGlobal('Creator'), creatorPk);
    // assert.deepEqual(getGlobal('StartDate'), BigInt(beginDate.getTime()));
    // assert.deepEqual(getGlobal('EndDate'), BigInt(endDate.getTime()));
    // assert.deepEqual(getGlobal('Goal'), 7000000n);
    // assert.deepEqual(getGlobal('Receiver'), creatorPk);
    // assert.deepEqual(getGlobal('Total'), 0n);

  });

  // it('should be rejected by logic when claiming funds if goal is not met', () => {
  //   // create application
  //   const creationFlags = Object.assign({}, flags);
  //   const applicationId = runtime.addApp(
  //     { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);

  //   // setup escrow account
  //   const escrowProg = getProgram('crowdFundEscrow.py', { APP_ID: applicationId });
  //   const lsig = runtime.getLogicSig(escrowProg, []);
  //   const escrowAddress = lsig.address();

  //   // sync escrow account
  //   escrow = runtime.getAccount(escrowAddress);
  //   console.log('Escrow Address: ', escrowAddress);
  //   syncAccounts();

  //   // update application with correct escrow account address
  //   let appArgs = [addressToPk(escrowAddress)]; // converts algorand address to Uint8Array
  //   runtime.updateApp(
  //     creator.address,
  //     applicationId,
  //     approvalProgram,
  //     clearProgram,
  //     {}, { appArgs: appArgs });

  //   appArgs = [stringToBytes('claim')];
  //   // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
  //   const txGroup = [
  //     {
  //       type: types.TransactionType.CallNoOpSSC,
  //       sign: types.SignType.SecretKey,
  //       fromAccount: creator.account,
  //       appId: applicationId,
  //       payFlags: {},
  //       appArgs: appArgs
  //     },
  //     {
  //       type: types.TransactionType.TransferAlgo,
  //       sign: types.SignType.LogicSignature,
  //       fromAccount: escrow.account,
  //       toAccountAddr: creator.address,
  //       amountMicroAlgos: 0,
  //       lsig: lsig,
  //       payFlags: { closeRemainderTo: creator.address }
  //     }
  //   ];
  //   // execute transaction: Expected to be rejected by logic because goal is not reached
  //   try {
  //     runtime.executeTx(txGroup);
  //   } catch (e) {
  //     console.warn(e);
  //   }
  // });
});
