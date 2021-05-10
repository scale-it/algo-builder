const {
  getProgram
} = require('@algo-builder/algob');
const { Runtime, AccountStore, types } = require('@algo-builder/runtime');
const { assert } = require('chai');

const minBalance = 20e6; // 20 ALGOs

const CLAWBACK = 'clawback.py';
const CONTROLLER = 'controller.py';
const PERMISSIONS = 'permissions.py';
const CLEAR_STATE = 'clear_state_program.py';

const ALICE_ADDRESS = 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY';

describe('Permissioned Token Tests', function () {
  let master = new AccountStore(10000e6);
  let alice, bob, elon;
  let runtime;
  let assetIndex, asaDef;
  let lsig, clawbackAddress;
  let controllerAppID, permissionsAppId;

  let CLAWBACK_PROGRAM;
  let CONTROLLER_PROGRAM;
  let PERMISSIONS_PROGRAM;
  const CLEAR_STATE_PROGRAM = getProgram(CLEAR_STATE);

  // Sync Accounts and ASA def
  function syncInfo () {
    master = runtime.getAccount(master.address);
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    elon = runtime.getAccount(elon.address);
    asaDef = runtime.getAssetDef(assetIndex);
  }

  // Opt-In account to ASA
  function optInToASA (acc) {
    runtime.optIntoASA(assetIndex, acc.address, {});
    syncInfo();
  }

  // Opt-In address to Permissions SSC
  function optInToPermissions (address) {
    runtime.optInToApp(address, permissionsAppId, {}, {});
    syncInfo();
  }

  // Issue some tokens to the passed account
  function issue (acc, amount) {
    const txns = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:issue'],
        foreignAssets: [assetIndex]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: clawbackAddress,
        recipient: acc.address,
        assetID: assetIndex,
        revocationTarget: alice.address,
        amount: amount,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      }
    ];
    runtime.executeTx(txns);
    syncInfo();
  }

  function killToken (manager) {
    runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: manager.account,
      appId: controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:kill'],
      foreignAssets: [assetIndex]
    });
    syncInfo();
  }

  // Whitelists the passed address for allowing token transfer
  function whitelist (manager, address) {
    optInToPermissions(address);
    runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: manager.account,
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:add_whitelist'],
      accounts: [address],
      foreignAssets: [assetIndex],
      foreignApps: [controllerAppID]
    });
    syncInfo();
  }

  // Fund the address with min ALGOs(20)
  function fund (address) {
    runtime.executeTx({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: address,
      amountMicroAlgos: minBalance,
      payFlags: {}
    });
    syncInfo();
  }

  // Transfer some token from `from` account to `to` account
  function transfer (from, to, amount) {
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: from.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [to.address],

      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: clawbackAddress,
        recipient: to.address,
        assetID: assetIndex,
        revocationTarget: from.address,
        amount: amount,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: clawbackAddress,
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: from.account,
        appId: permissionsAppId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [to.address, from.address]
      }
    ];
    runtime.executeTx(txGroup);
    syncInfo();
  }

  // Performs Opt-Out operation 
  function optOut(acc) {
    const optOutParams = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: acc.account,
      toAccountAddr: acc.address,
      assetID: assetIndex,
      amount: 0,
      payFlags: { totalFee: 1000, closeRemainderTo: alice.address }
    };
    runtime.executeTx(optOutParams);
    syncInfo();
  }

  // Performs force transfer of token using ASA manager account
  function force_transfer(from, to, amount) {
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:force_transfer'],
        accounts: [to.address],
        foreignAssets: [assetIndex]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: clawbackAddress,
        recipient: to.address,
        assetID: assetIndex,
        revocationTarget: from.address,
        amount: amount,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: clawbackAddress,
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        appId: permissionsAppId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [to.address, from.address]
      }
    ];
    runtime.executeTx(txGroup);
    syncInfo();
  }

  this.beforeEach(async function () {
    // Create Accounts and Env
    alice = new AccountStore(minBalance, { addr: ALICE_ADDRESS, sk: new Uint8Array(0) });
    bob = new AccountStore(minBalance);
    elon = new AccountStore(minBalance);
    runtime = new Runtime([master, alice, bob, elon]);

    // Deploy ASA
    assetIndex = runtime.addAsset('gold', { creator: { ...alice.account, name: 'alice' } });
    asaDef = runtime.getAssetDef(assetIndex);

    // Deploy Controller SSC
    let sscFlags = {
      sender: alice.account,
      localInts: 0,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 0,
      appArgs: [`int:${assetIndex}`],
      foreignAssets: [assetIndex]
    };
    CONTROLLER_PROGRAM = getProgram(CONTROLLER, { TOKEN_ID: assetIndex });
    controllerAppID = runtime.addApp(
      sscFlags, {}, CONTROLLER_PROGRAM, CLEAR_STATE_PROGRAM
    );

    // Deploy Clawback Lsig and Modify Asset
    CLAWBACK_PROGRAM = getProgram(CLAWBACK, {
      TOKEN_ID: assetIndex,
      CONTROLLER_APP_ID: controllerAppID
    });
    lsig = runtime.getLogicSig(CLAWBACK_PROGRAM, []);
    clawbackAddress = lsig.address();
    fund(clawbackAddress);
    runtime.executeTx({
      type: types.TransactionType.ModifyAsset,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      assetID: assetIndex,
      fields: {
        manager: asaDef.manager,
        reserve: asaDef.reserve,
        freeze: asaDef.freeze,
        clawback: clawbackAddress
      },
      payFlags: { totalFee: 1000 }
    });
    runtime.optIntoASA(assetIndex, clawbackAddress, {});

    syncInfo();

    // Deploy Permissions SSC
    PERMISSIONS_PROGRAM = getProgram(PERMISSIONS, { PERM_MANAGER: alice.address });
    sscFlags = {
      sender: alice.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 1,
      appArgs: [`int:${controllerAppID}`]
    };
    permissionsAppId = runtime.addApp(
      sscFlags, {}, PERMISSIONS_PROGRAM, CLEAR_STATE_PROGRAM
    );

    // Add permissions SSC config to Controller SSC
    const appArgs = [
      'str:set_permission',
      `int:${permissionsAppId}`
    ];
    runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      appId: controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: appArgs,
      foreignAssets: [assetIndex]
    });

    // Refresh Accounts and ASADef
    syncInfo();
  });

  it('Token Issuance', () => {
    // Cannot issue before opting-in
    assert.throws(() => issue(elon, 20), 'RUNTIME_ERR1404');

    // Can issue after optin-in
    optInToASA(elon);
    issue(elon, 20);
    assert.equal(20, runtime.getAssetHolding(assetIndex, elon.address).amount);

    // Cannot issue after killing token
    killToken(alice);
    assert.throws(() => issue(elon, 20), 'RUNTIME_ERR1009');
  });

  it('Kill Token', () => {
    // Expected to fail as wrong ASA manager is passed
    assert.throws(() => killToken(bob), 'RUNTIME_ERR1009');
    
    // Works as correct ASA manager is passed
    killToken(alice);
    assert.throws(() => issue(elon, 5), 'RUNTIME_ERR1009');
  });

  it('WhiteListing', () => {
    // Only asset manager can whitelist
    const address = elon.address;
    optInToPermissions(address);
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

    // Works with correct ASA manager
    whitelist(alice, address);
    assert.equal(
      Number(elon.getLocalState(permissionsAppId, 'whitelisted')),
      1
    );
  });

  it('Opt Out', () => {
    // Opt-out wont work without opting in
    assert.throws(() => optOut(elon), 'RUNTIME_ERR1404');
    console.log(elon);

    // Opt-In
    optInToASA(elon);

    // Works because opted-in
    optOut(elon);
    assert.throws(() => 
      runtime.getAssetHolding(assetIndex, elon.address), 
      'RUNTIME_ERR1404'
    );
  });

  it('Change Permissions SSC Manager', () => {
    // Optin In new SSC manager to the SSC
    optInToPermissions(elon.address);

    // whitelist operation can only be performed by permissions SSC manager
    assert.throws(() => whitelist(elon, bob.address), 'RUNTIME_ERR1009');

    let txn = {
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
    
    txn.fromAccount = alice.account;

    // works as fromAccount is the current SSC manager
    runtime.executeTx(txn);
    syncInfo();
    whitelist(elon, bob.address);
  });

  it('Force Transfer', () => {
    // Opt-In to permissions SSC & Whitelist
    whitelist(alice, alice.address);
    whitelist(alice, bob.address);
    whitelist(alice, elon.address);

    // Opt-In to ASA
    optInToASA(bob);
    optInToASA(elon);

    // Issue some tokens to sender
    issue(bob, 150);
    
    force_transfer(bob, elon, 20);
  })

  it('Token Transfer', () => {
    fund(elon.address);
    fund(bob.address);
    fund(alice.address);
    fund(clawbackAddress);
    const amount = 20;

    // Issue some tokens to Bob and Elon
    optInToASA(elon);
    optInToASA(bob);
    issue(elon, 50);
    issue(bob, 50);

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
    assert.throws(() => transfer(bob, elon, amount), 'RUNTIME_ERR1009');

    // Can transfer after being whitelisted
    whitelist(alice, elon.address);
    whitelist(alice, bob.address);
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
    const bobBalance = runtime.getAssetHolding(assetIndex, elon.address).amount;
    transfer(bob, elon, amount);
    assert.equal(
      Number(runtime.getAssetHolding(assetIndex, elon.address).amount),
      Number(elonBalance) + amount
    );
    assert.equal(
      Number(runtime.getAssetHolding(assetIndex, elon.address).amount),
      Number(bobBalance) + amount
    );
  });
});

