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

describe('Permissioned Token Tests - Failing Paths', function () {
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

  it('Token Issuance - Cannot issue before opt-in or after token is killed', () => {
    // Cannot issue before opt-in to ASA by receiver
    // RUNTIME_ERR1404 : Account doesn't hold asset index
    assert.throws(() => issue(runtime, alice, elon, 20, controllerAppID, assetIndex, lsig), 'RUNTIME_ERR1404');

    // Opting-in
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();

    // Cannot issue after killing token
    killToken(runtime, alice, controllerAppID);
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    assert.throws(() => issue(runtime, alice, elon, 20, controllerAppID, assetIndex, lsig), 'RUNTIME_ERR1009');
  });

  it('Kill Token - Only ASA manager or Permissions Manager can kill', () => {
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    assert.throws(() => killToken(runtime, bob, controllerAppID), 'RUNTIME_ERR1009');
  });

  it('WhiteListing - Only ASA/Permissions manager can perform whitelist', () => {
    // Only asset manager/permissions manager can whitelist
    const address = elon.address;
    optInToPermissions(runtime, address, permissionsAppId);
    syncAccounts();
    assert.isDefined(elon.getAppFromLocal(permissionsAppId));

    // Fails because Bob is not the manager
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    assert.throws(() => runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: bob.account, // Bob is not the asset manager
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:add_whitelist'],
      accounts: [address]
    }), 'RUNTIME_ERR1009');
  });

  it('Opt Out - User should be opted-in first', () => {
    // Opt-out wont work without opting in
    // RUNTIME_ERR1404 : Account doesn't hold asset index
    assert.throws(() => optOut(runtime, alice, elon, assetIndex), 'RUNTIME_ERR1404');
  });

  it('Change Permissions SSC Manager - Only current Permissions manager can perform this', () => {
    // Optin In new SSC manager to the SSC
    optInToPermissions(runtime, elon.address, permissionsAppId);
    syncAccounts();

    // whitelist operation can only be performed by permissions SSC manager
    // RUNTIME_ERR1009 : TEAL encountered err opcode
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
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    assert.throws(() => runtime.executeTx(txn), 'RUNTIME_ERR1009');
  });

  it('Force Transfer - Only Permissions manager can perform this', () => {
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

    // Fails as only manager(alice) can perform force transfer
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    assert.throws(() =>
      forceTransfer(runtime, bob, elon, 20, assetIndex, controllerAppID, permissionsAppId, lsig, bob),
    'RUNTIME_ERR1009'
    );

    // Fails as reciever will have more than 100 tokens post succesfull transaction
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    assert.throws(() =>
      forceTransfer(runtime, bob, elon, 101, assetIndex, controllerAppID, permissionsAppId, lsig, alice),
    'RUNTIME_ERR1009'
    );
  });

  it('Token Transfer - Transfer can only happen if transaction has the required structure, both sender and receiver are whitelisted and receiver will have less than 100 tokens', () => {
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
    issue(runtime, alice, elon, 60, controllerAppID, assetIndex, lsig);
    issue(runtime, alice, bob, 50, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // Cannot transfer directly, must call clawback
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
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    assert.isUndefined(elon.getAppFromLocal(permissionsAppId));
    assert.throws(() =>
      transfer(runtime, bob, elon, amount, assetIndex, controllerAppID, permissionsAppId, lsig),
      'RUNTIME_ERR1009'
    );

    // Both sender and receiver needs to be whitelisted before transferring tokens
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    whitelist(runtime, alice, bob.address, assetIndex, controllerAppID, permissionsAppId);
    syncAccounts();
    assert.isDefined(bob.getAppFromLocal(permissionsAppId));
    assert.throws(() =>
      transfer(runtime, bob, elon, amount, assetIndex, controllerAppID, permissionsAppId, lsig),
      'RUNTIME_ERR1009'
    );

    // Cannot transfer as receiver will have more than 100 Tokens 
    // RUNTIME_ERR1009 : TEAL encountered err opcode
    whitelist(runtime, alice, elon.address, assetIndex, controllerAppID, permissionsAppId);
    syncAccounts();
    assert.isDefined(elon.getAppFromLocal(permissionsAppId));
    assert.throws(() =>
      transfer(runtime, bob, elon, 50, assetIndex, controllerAppID, permissionsAppId, lsig),
      'RUNTIME_ERR1009'
    );

    // Call to the Controller App is necessary
    // RUNTIME_ERR1007: Teal code rejected by logic
    let txGroup = [
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsig.address(),
        recipient: elon.address,
        assetID: assetIndex,
        revocationTarget: bob.address,
        amount: amount,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        toAccountAddr: lsig.address(),
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        appId: permissionsAppId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [bob.address, elon.address]
      }
    ];
    assert.throws(() =>
      runtime.executeTx(txGroup),
      'RUNTIME_ERR1007'
    );

    // Call to the Permissions App is necessary
    // RUNTIME_ERR1008: Index out of bound
    txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [elon.address]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsig.address(),
        recipient: elon.address,
        assetID: assetIndex,
        revocationTarget: bob.address,
        amount: amount,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        toAccountAddr: lsig.address(),
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      }
    ];
    assert.throws(() =>
      runtime.executeTx(txGroup),
      'RUNTIME_ERR1008'
    );

    // Call to Controller and Clawback should be made by sender
    // RUNTIME_ERR1009: TEAL runtime encountered err opcode
    txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [elon.address]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsig.address(),
        recipient: elon.address,
        assetID: assetIndex,
        revocationTarget: bob.address,
        amount: amount,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        toAccountAddr: lsig.address(),
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        appId: permissionsAppId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [bob.address, elon.address]
      }
    ];
    assert.throws(() =>
      runtime.executeTx(txGroup),
      'RUNTIME_ERR1009'
    );
  });
});
