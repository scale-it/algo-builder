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

  function syncInfo () {
    master = runtime.getAccount(master.address);
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    elon = runtime.getAccount(elon.address);
    asaDef = runtime.getAssetDef(assetIndex);
  }

  function optInToASA (acc) {
    runtime.optIntoASA(assetIndex, acc.address, {});
    syncInfo();
  }

  function optInToPermissions (address) {
    runtime.optInToApp(address, permissionsAppId, {}, {});
    syncInfo();
  }

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

  function killToken () {
    runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      appId: controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:kill'],
      foreignAssets: [assetIndex]
    });
    syncInfo();
  }

  function whitelist (address) {
    optInToPermissions(address);
    runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:add_whitelist', `int:${controllerAppID}`],
      accounts: [address],
      foreignAssets: [assetIndex],
      foreignApps: [controllerAppID]
    });
    syncInfo();
  }

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

  function transfer (from, to, amount) {
    const txGroup = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: from.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:transfer'],
        accounts: [elon.address]
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
        accounts: [to.address]
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

    // Setup Controller SSC
    let sscFlags = {
      sender: alice.account,
      localInts: 0,
      localBytes: 1,
      globalInts: 4,
      globalBytes: 2,
      appArgs: [`int:${assetIndex}`],
      foreignAssets: [assetIndex]
    };
    CONTROLLER_PROGRAM = getProgram(CONTROLLER, { TOKEN_ID: assetIndex });
    controllerAppID = runtime.addApp(
      sscFlags, {}, CONTROLLER_PROGRAM, CLEAR_STATE_PROGRAM
    );

    // Setup Permissions SSC
    PERMISSIONS_PROGRAM = getProgram(PERMISSIONS, { CONTROLLER_APP_ID: controllerAppID });
    sscFlags = {
      sender: alice.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 3,
      globalBytes: 1,
      appArgs: [`int:${controllerAppID}`]
    };
    permissionsAppId = runtime.addApp(
      sscFlags, {}, PERMISSIONS_PROGRAM, CLEAR_STATE_PROGRAM
    );

    // Add permissions SSC config to Controller SSC
    const appArgs = [
      'str:add_permission',
      `int:${permissionsAppId}`,
      `addr:${alice.address}`
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

    // Refresh Accounts
    syncInfo();
  });

  it('Token Issuance', () => {
    // Cannot issue before opting-in
    assert.throws(() => issue(elon, 20), 'RUNTIME_ERR1404');

    // Can issue after optin-in
    optInToASA(elon);
    // syncInfo();
    issue(elon, 20);
    assert.equal(20, runtime.getAssetHolding(assetIndex, elon.address).amount);

    // Cannot issue after killing token
    killToken();
    assert.throws(() => issue(elon, 20), 'RUNTIME_ERR1009');
  });

  it('WhiteListing', () => {
    // Only asset manager can whitelist
    const address = elon.address;
    optInToPermissions(address);
    assert.isDefined(elon.getAppFromLocal(permissionsAppId));

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

    whitelist(address);
    assert.equal(
      Number(elon.getLocalState(permissionsAppId, 'whitelisted')),
      1
    );
  });

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
    whitelist(elon.address);
    whitelist(bob.address);
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
