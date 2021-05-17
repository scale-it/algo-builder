const { types } = require('@algo-builder/runtime');
const { assert } = require('chai');
const {
  optInToASA,
  optInToPermissionsSSC,
  issue,
  whitelist,
  fund,
  killToken,
  transfer,
  optOut,
  forceTransfer,
  setupEnv
} = require('./common');

describe('Permissioned Token Tests - Happy Paths', function () {
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
    // Can issue after opting-in
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();
    issue(runtime, alice.account, elon, 20, controllerAppID, assetIndex, lsig);
    syncAccounts();
    assert.equal(20, runtime.getAssetHolding(assetIndex, elon.address).amount);
  });

  it('Kill Token', () => {
    // Works as correct ASA manager is passed
    killToken(runtime, alice.account, controllerAppID);
    assert.throws(() => issue(runtime, alice.account, elon, 20, controllerAppID, assetIndex, lsig), 'RUNTIME_ERR1009');
  });

  it('WhiteListing', () => {
    // Only asset manager can whitelist
    const elonAddr = elon.address;
    optInToPermissionsSSC(runtime, elonAddr, permissionsAppId);
    syncAccounts();
    assert.isDefined(elon.getAppFromLocal(permissionsAppId));

    // Works with correct ASA manager
    const asaDef = runtime.getAssetDef(assetIndex);
    assert.equal(asaDef.manager, alice.address);
    whitelist(runtime, alice.account, elonAddr, permissionsAppId);
    syncAccounts();
    assert.equal(
      Number(elon.getLocalState(permissionsAppId, 'whitelisted')),
      1
    );
  });

  it('Opt Out', () => {
    // Opt-In
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();
    issue(runtime, alice.account, elon, 20, controllerAppID, assetIndex, lsig);
    syncAccounts();
    assert.equal(
      runtime.getAssetHolding(assetIndex, elon.address).amount,
      20
    );

    // Works because opted-in
    optOut(runtime, alice.address, elon.account, assetIndex);
    syncAccounts();
    assert.equal(
      runtime.getAssetHolding(assetIndex, elon.address).amount,
      0
    );
  });

  it('Change Permissions SSC Manager', () => {
    // Optin In new SSC manager to the SSC
    optInToPermissionsSSC(runtime, elon.address, permissionsAppId);
    syncAccounts();

    const txn = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account, // asset manager account (fails otherwise)
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:change_permissions_manager'],
      accounts: [elon.address]
    };

    // works as fromAccount is the current SSC manager
    runtime.executeTx(txn);
    syncAccounts();
    whitelist(runtime, elon.account, bob.address, permissionsAppId);
  });

  it('Force Transfer', () => {
    // Opt-In to permissions SSC & Whitelist
    whitelist(runtime, alice.account, alice.address, permissionsAppId);
    whitelist(runtime, alice.account, elon.address, permissionsAppId);
    whitelist(runtime, alice.account, bob.address, permissionsAppId);
    syncAccounts();

    // Opt-In to ASA
    optInToASA(runtime, bob.address, assetIndex);
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();

    // Issue some tokens to sender
    issue(runtime, alice.account, bob, 150, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // Successful transfer
    const elonBalance = runtime.getAssetHolding(assetIndex, elon.address).amount;
    const bobBalance = runtime.getAssetHolding(assetIndex, bob.address).amount;
    forceTransfer(runtime, bob, elon, 20, assetIndex, controllerAppID, permissionsAppId, lsig, alice);
    assert.equal(
      Number(runtime.getAssetHolding(assetIndex, elon.address).amount),
      Number(elonBalance) + 20
    );
    assert.equal(
      Number(runtime.getAssetHolding(assetIndex, bob.address).amount),
      Number(bobBalance) - 20
    );

    // Succesful transfer if Receiver is Asset Reserver Account
    // const asaDef = runtime.getAssetDef(assetIndex);
    // console.log(asaDef);
    // bobBalance = runtime.getAssetHolding(assetIndex, bob.address).amount;
    // let aliceBalance = runtime.getAssetHolding(assetIndex, alice.address).amount;
    // console.log(bobBalance);
    // console.log(aliceBalance);
    // forceTransfer(runtime, bob, alice, 20, assetIndex, controllerAppID, permissionsAppId, lsig, alice);
    // assert.equal(
    //   Number(runtime.getAssetHolding(assetIndex, alice.address).amount),
    //   Number(aliceBalance) + 20
    // );
    // assert.equal(
    //   Number(runtime.getAssetHolding(assetIndex, bob.address).amount),
    //   Number(bobBalance) - 20
    // );
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
    issue(runtime, alice.account, elon, 50, controllerAppID, assetIndex, lsig);
    issue(runtime, alice.account, bob, 50, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // Successful transfer after being whitelisted
    whitelist(runtime, alice.account, elon.address, permissionsAppId);
    whitelist(runtime, alice.account, bob.address, permissionsAppId);
    syncAccounts();
    assert.isDefined(elon.getAppFromLocal(permissionsAppId));
    assert.isDefined(bob.getAppFromLocal(permissionsAppId));
    assert.equal(
      Number(elon.getLocalState(permissionsAppId, 'whitelisted')),
      1
    );
    assert.equal(
      Number(bob.getLocalState(permissionsAppId, 'whitelisted')),
      1
    );
    const elonBalance = runtime.getAssetHolding(assetIndex, elon.address).amount;
    const bobBalance = runtime.getAssetHolding(assetIndex, bob.address).amount;
    transfer(runtime, bob, elon, amount, assetIndex, controllerAppID, permissionsAppId, lsig);
    syncAccounts();
    assert.equal(
      Number(runtime.getAssetHolding(assetIndex, elon.address).amount),
      Number(elonBalance) + amount
    );
    assert.equal(
      Number(runtime.getAssetHolding(assetIndex, bob.address).amount),
      Number(bobBalance) - amount
    );
  });
});
