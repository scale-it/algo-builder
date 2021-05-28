import { getProgram } from '@algo-builder/algob';
import { AccountStore, addressToPk, Runtime, types } from '@algo-builder/runtime';
import { assert } from 'chai';

const minBalance = 10e6; // 10 ALGO's
const aliceAddr = 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY';
const bobAddr = '2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ';
const ACCRED_LEVEL = 'Accred-Level';

describe('Test for transferring asset using custom logic', function () {
  const master = new AccountStore(1000e6);
  let alice;
  let bob;
  let escrow; // initialized later (using runtime.getLogicSig)

  let runtime;
  let creationFlags;
  let applicationId;
  let assetId;
  let assetDef;
  const approvalProgram = getProgram('poi-approval.teal');
  const clearProgram = getProgram('poi-clear.teal');

  this.beforeEach(async function () {
    alice = new AccountStore(minBalance, { addr: aliceAddr, sk: new Uint8Array(0) });
    bob = new AccountStore(minBalance, { addr: bobAddr, sk: new Uint8Array(0) });
    runtime = new Runtime([master, alice, bob]);

    creationFlags = {
      sender: alice.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 1
    };

    /* Create asset + optIn to asset */
    assetId = runtime.addAsset('gold', { creator: { ...alice.account, name: 'alice' } });
    assetDef = runtime.getAssetDef(assetId);

    assert.equal(assetDef.creator, alice.address);
    assert.equal(assetDef.defaultFrozen, true);
    assert.equal(assetDef.total, 1000000);
    assert.equal(assetDef.unitName, 'GLD');
    assert.equal(assetDef.manager, alice.address);
    assert.equal(assetDef.clawback, alice.address);

    runtime.optIntoASA(assetId, bob.address, {});
    const aliceAssetHolding = runtime.getAssetHolding(assetId, aliceAddr);
    const bobAssetHolding = runtime.getAssetHolding(assetId, bobAddr);
    assert.isDefined(aliceAssetHolding);
    assert.isDefined(bobAssetHolding);

    /* Create application + optIn to app */
    const creationArgs = [
      `int:${assetId}`,
      'int:2' // set min user level(2) for asset transfer ("Accred-level")
    ];
    applicationId = runtime.addApp(
      { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);

    const app = alice.getApp(applicationId);
    const alicePk = addressToPk(alice.address);

    // verify global state after app creation
    assert.isDefined(app);
    assert.deepEqual(getGlobal('Creator'), alicePk);
    assert.deepEqual(getGlobal('AssetID'), BigInt(assetId));
    assert.deepEqual(getGlobal('AssetLevel'), 2n); // we are setting level 2 in examples
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationId, key);
  const getEscrowProg = (assetId, appId) =>
    getProgram('clawback-escrow.py', { ASSET_ID: assetId, APP_ID: appId });

  // Update account state
  function syncAccounts () {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    if (escrow) { escrow = runtime.getAccount(escrow.address); }
  }

  it('should transfer 1000 Assets from Alice to Bob according to custom logic', () => {
    /**
     * This test demonstrates how to transfer assets from account A to B using custom logic
     * based on a smart contract. Asset is actually transferred by the clawback address (an escrow
     * account in this case). Following operations are performed
     * - Create the asset + optIn
     * - Create the application + optIn
     * - Setup Escrow Account
     * - Update Asset clawback + lock manager and freeze address
     * - Set Accred-Level
     * - Transfer Asset from Alice -> Bob (assets are revoken via clawback escrow)
     */

    // opt in to app + verify optin
    runtime.optInToApp(alice.address, applicationId, {}, {});
    runtime.optInToApp(bob.address, applicationId, {}, {});
    syncAccounts();

    const aliceLocalApp = alice.getAppFromLocal(applicationId);
    const bobLocalApp = bob.getAppFromLocal(applicationId);
    assert.isDefined(aliceLocalApp);
    assert.isDefined(bobLocalApp);

    /* Setup Escrow Account */
    const escrowProg = getEscrowProg(assetId, applicationId);
    const escrowLsig = runtime.getLogicSig(escrowProg, []);
    const escrowAddress = escrowLsig.address();

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

    /** Update clawback address to escrow + Locking the manager and freeze address **/
    const assetModFields = {
      manager: '',
      reserve: alice.address,
      freeze: '',
      clawback: escrowAddress
    };

    const assetConfigParams = {
      type: types.TransactionType.ModifyAsset,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      assetID: assetId,
      fields: assetModFields,
      payFlags: { totalFee: 1000 }
    };
    runtime.executeTx(assetConfigParams);

    // verify clawback is updated & manager, freeze address is set to ""
    assetDef = runtime.getAssetDef(assetId);
    assert.equal(assetDef.clawback, escrowAddress);
    assert.equal(assetDef.manager, '');
    assert.equal(assetDef.freeze, '');

    /* Updating clawback again should throw error now (since we set the asset manager to ``) */
    const newCfgParams = {
      ...assetConfigParams,
      fields: {
        ...assetModFields,
        clawback: bob.address
      }
    };
    try {
      runtime.executeTx(newCfgParams);
    } catch (e) {
      console.log('[Expected] ', e.message); // cannot modify asset.
    }

    /**
     * Set level 2 for Alice & Bob. While creating the application we set the min level to be 2,
     * so if any of the accounts(sender, receiver) has a level < 2, tx will be rejected.
     */
    const setLevelParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      appId: applicationId,
      payFlags: {},
      appArgs: ['str:set-level', 'int:2'],
      accounts: [alice.address] //  AppAccounts
    };

    runtime.executeTx(setLevelParams); // set level for alice
    runtime.executeTx({ ...setLevelParams, accounts: [bob.address] }); // set level for bob
    syncAccounts();

    // verify level is set in local-state
    assert.equal(alice.getLocalState(applicationId, ACCRED_LEVEL), 2n);
    assert.equal(bob.getLocalState(applicationId, ACCRED_LEVEL), 2n);

    /* Transfer 1000 assets from Alice to Bob (assets are revoken via clawback escrow) */
    const prevAliceAssets = runtime.getAssetHolding(assetId, aliceAddr).amount;
    const prevBobAssets = runtime.getAssetHolding(assetId, bobAddr).amount;
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:check-level'],
        accounts: [bob.address] //  AppAccounts
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: escrowAddress,
        recipient: bob.address,
        assetID: assetId,
        revocationTarget: alice.address,
        amount: 1000,
        lsig: escrowLsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(txGroup);
    syncAccounts();

    const afterAliceAssets = runtime.getAssetHolding(assetId, aliceAddr).amount;
    const afterBobAssets = runtime.getAssetHolding(assetId, bobAddr).amount;
    assert.equal(afterAliceAssets, prevAliceAssets - 1000n);
    assert.equal(afterBobAssets, prevBobAssets + 1000n); // Bob received 1000 GLD
  });

  it('should fail on set level if sender is not creator', () => {
    // opt in to app
    runtime.optInToApp(alice.address, applicationId, {}, {});
    runtime.optInToApp(bob.address, applicationId, {}, {});

    /* Setup Escrow Account */
    const escrowProg = getEscrowProg(assetId, applicationId); ;
    const escrowLsig = runtime.getLogicSig(escrowProg, []);
    const escrowAddress = escrowLsig.address();

    // sync escrow account
    escrow = runtime.getAccount(escrowAddress);

    syncAccounts();
    const setLevelParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: bob.account,
      appId: applicationId,
      payFlags: {},
      appArgs: ['str:set-level', 'int:2'],
      accounts: [alice.address] //  AppAccounts
    };

    try {
      runtime.executeTx(setLevelParams);
    } catch (e) {
      console.log('[Expected as Sender(Bob) !== Creator(Alice)', e.errorDescriptor);
    }
  });

  it('should reject transaction if minimum level is not set correctly', () => {
    assetId = runtime.addAsset('gold', { creator: { ...alice.account, name: 'alice' } });
    runtime.optIntoASA(assetId, bob.address, {});

    /* Create application + optIn to app */
    const creationArgs = [
      `int:${assetId}`,
      'int:2' // set min user level(2) for asset transfer ("Accred-level")
    ];

    applicationId = runtime.addApp(
      { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);
    const app = alice.getApp(applicationId);
    assert.isDefined(app);

    // opt in to app + verify optin
    runtime.optInToApp(alice.address, applicationId, {}, {});
    runtime.optInToApp(bob.address, applicationId, {}, {});

    /* Setup Escrow Account */
    const escrowProg = getEscrowProg(assetId, applicationId);
    const escrowLsig = runtime.getLogicSig(escrowProg, []);
    const escrowAddress = escrowLsig.address();

    // sync escrow account
    escrow = runtime.getAccount(escrowAddress);

    /* Setting level 1 (and minimum req is 2), so it should fail on asset transfer */
    syncAccounts();
    alice.setLocalState(applicationId, ACCRED_LEVEL, 1n);
    bob.setLocalState(applicationId, ACCRED_LEVEL, 1n);

    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        appId: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:check-level'],
        accounts: [bob.address] //  AppAccounts
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: escrowAddress,
        recipient: bob.address,
        assetID: assetId,
        revocationTarget: alice.address,
        amount: 1000,
        lsig: escrowLsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      }
    ];

    try {
      runtime.executeTx(txGroup);
    } catch (e) {
      console.log('[Expected as level Alice(=1) < Min Level(=2)] ', e.errorDescriptor);
    }
  });
});
