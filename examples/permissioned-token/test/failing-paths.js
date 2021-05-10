const { types } = require('@algo-builder/runtime');
const { assert } = require('chai');
const {
  optInToASA,
  optInToPermissions,
  issue,
  whitelist,
  fund,
  killToken,
  transfer,
  optOut,
  forceTransfer,
  setupEnv
} = require('./common');

describe('Permissioned Token Tests -- Failing Paths', function () {
  let runtime, master, alice, bob, elon;
  let lsig, assetIndex, controllerAppID, permissionsAppId;

  // Sync Accounts and ASA def
  function syncAccounts () {
    master = runtime.getAccount(master.address);
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    elon = runtime.getAccount(elon.address);
  }

  this.beforeEach(async function () {
    // Create Accounts and Env
    [
      runtime,
      master,
      alice,
      bob,
      elon,
      assetIndex,
      controllerAppID,
      lsig,
      permissionsAppId
    ] = setupEnv();
  });

  it('Token Issuance', () => {
    // Cannot issue before opting-in
    assert.throws(() => issue(runtime, alice, elon, 20, controllerAppID, assetIndex, lsig), 'RUNTIME_ERR1404');

    // Opting-in
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();

    // Cannot issue after killing token
    killToken(runtime, alice, controllerAppID);
    assert.throws(() => issue(runtime, alice, elon, 20, controllerAppID, assetIndex, lsig), 'RUNTIME_ERR1009');
  });

  it('Kill Token', () => {
    // Fails as wrong ASA manager is passed
    assert.throws(() => killToken(runtime, bob, controllerAppID), 'RUNTIME_ERR1009');
  });

  it('WhiteListing', () => {
    // Only asset manager can whitelist
    const address = elon.address;
    optInToPermissions(runtime, address, permissionsAppId);
    syncAccounts();
    assert.isDefined(elon.getAppFromLocal(permissionsAppId));

    // Fails because Bob is not the manager
    assert.throws(() => runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: bob.account, // Bob is not the asset manager
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:add_whitelist', `int:${controllerAppID}`],
      accounts: [address],
      foreignAssets: [assetIndex],
      foreignApps: [controllerAppID]
    }), 'RUNTIME_ERR1009');
  });

  it('Opt Out', () => {
    // Opt-out wont work without opting in
    assert.throws(() => optOut(runtime, alice, elon, 20, assetIndex), 'RUNTIME_ERR1404');
  });

  it('Change Permissions SSC Manager', () => {
    // Optin In new SSC manager to the SSC
    optInToPermissions(runtime, elon.address, permissionsAppId);
    syncAccounts();

    // whitelist operation can only be performed by permissions SSC manager
    assert.throws(() => whitelist(runtime, elon, bob.address, assetIndex, controllerAppID, permissionsAppId), 'RUNTIME_ERR1009');

    const txn = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: bob.account, // asset manager account (fails otherwise)
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:change_permissions_manager'],
      accounts: [elon.address]
    };

    // fails as fromAccount is not the current SSC manager
    assert.throws(() => runtime.executeTx(txn), 'RUNTIME_ERR1009');
  });

  it('Force Transfer', () => {
    // Opt-In to permissions SSC & Whitelist
    whitelist(runtime, alice, alice.address, assetIndex, controllerAppID, permissionsAppId);
    whitelist(runtime, alice, elon.address, assetIndex, controllerAppID, permissionsAppId);
    whitelist(runtime, alice, bob.address, assetIndex, controllerAppID, permissionsAppId);
    syncAccounts();

    // Opt-In to ASA
    optInToASA(runtime, bob.address, assetIndex);
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();

    // Issue some tokens to sender
    issue(runtime, alice, bob, 150, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // Fails as only manager can perform force transfer
    assert.throws(() =>
      forceTransfer(runtime, bob, elon, 20, assetIndex, controllerAppID, permissionsAppId, lsig, bob),
    'RUNTIME_ERR1009'
    );

    // Fails as reciever will have more than 100 tokens post succesfull transaction
    assert.throws(() =>
      forceTransfer(runtime, bob, elon, 101, assetIndex, controllerAppID, permissionsAppId, lsig, alice),
    'RUNTIME_ERR1009'
    );
  });

  it('Token Transfer', () => {
    fund(runtime, master, elon.address);
    fund(runtime, master, bob.address);
    fund(runtime, master, alice.address);
    fund(runtime, master, lsig.address());
    syncAccounts();
    const amount = 20;

    // Issue some tokens to Bob and Elon
    optInToASA(runtime, elon.address, assetIndex);
    optInToASA(runtime, bob.address, assetIndex);
    syncAccounts();
    issue(runtime, alice, elon, 50, controllerAppID, assetIndex, lsig);
    issue(runtime, alice, bob, 50, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // Cannot transfer directly
    assert.throws(() => runtime.executeTx({
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: bob.account,
      toAccountAddr: elon.address,
      amount: amount,
      assetID: assetIndex,
      payFlags: {}
    }), 'RUNTIME_ERR1505');

    // Cannot transfer before being whitelisted
    assert.throws(() =>
      transfer(runtime, bob, elon, amount, assetIndex, controllerAppID, permissionsAppId, lsig),
    'RUNTIME_ERR1009'
    );
  });
});
