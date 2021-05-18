const { types } = require('@algo-builder/runtime');
const { encodeAddress } = require('algosdk');
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
  let asaDef, asaReserve, asaManager, asaCreator;

  function syncAccounts () {
    master = runtime.getAccount(master.address);
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    elon = runtime.getAccount(elon.address);
  }

  // Create Accounts and Env
  function _setupEnv () {
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
  }

  this.beforeEach(async function () {
    _setupEnv();
    asaDef = runtime.getAssetDef(assetIndex);
    asaReserve = runtime.getAccount(asaDef.reserve);
    asaManager = runtime.getAccount(asaDef.manager);
    asaCreator = runtime.getAccount(asaDef.creator);
  });

  it('should issue token if sender is token reserve', () => {
    // Can issue after opting-in
    optInToASA(runtime, elon.address, assetIndex);
    const prevElonAssetHolding = runtime.getAssetHolding(assetIndex, elon.address);
    assert.equal(prevElonAssetHolding.amount, 0n);

    issue(runtime, asaReserve.account, elon, 20, controllerAppID, assetIndex, lsig);
    syncAccounts();

    assert.equal(
      runtime.getAssetHolding(assetIndex, elon.address).amount,
      prevElonAssetHolding.amount + 20n
    );
  });

  it('should kill token if sender is token manager', () => {
    assert.equal(runtime.getGlobalState(controllerAppID, 'killed'), 0n); // token not killed

    // kill token
    killToken(runtime, asaManager.account, controllerAppID);
    syncAccounts();

    assert.equal(runtime.getGlobalState(controllerAppID, 'killed'), 1n); // verify token is killed
    // issuance fails now (as token is killed)
    assert.throws(() =>
      issue(runtime, asaReserve.account, elon, 20, controllerAppID, assetIndex, lsig),
    'RUNTIME_ERR1009: TEAL runtime encountered err opcode');
  });

  it('should whitelist account if sender is permissions manager', () => {
    // opt-in to permissions ssc by elon
    optInToPermissionsSSC(runtime, elon.address, permissionsAppId);
    syncAccounts();
    assert.isDefined(elon.getAppFromLocal(permissionsAppId)); // verify opt-in

    const permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
    const permManager = runtime.getAccount(permManagerAddr);
    whitelist(runtime, permManager.account, elon.address, permissionsAppId); // whitelist elon
    syncAccounts();
    assert.equal(elon.getLocalState(permissionsAppId, 'whitelisted'), 1n);
  });

  it('should opt-out of token successfully (using closeRemainderTo)', () => {
    // Opt-In
    optInToASA(runtime, elon.address, assetIndex);
    issue(runtime, asaReserve.account, elon, 20, controllerAppID, assetIndex, lsig);
    syncAccounts();
    // verify issuance
    assert.equal(
      runtime.getAssetHolding(assetIndex, elon.address).amount,
      20n
    );

    // opt-out issued tokens to creator
    const initialCreatorHolding = runtime.getAssetHolding(assetIndex, asaCreator.address);
    optOut(runtime, asaCreator.address, elon.account, assetIndex);
    syncAccounts();

    // verify elon and creator's asset holding (after opting out)
    assert.equal(runtime.getAssetHolding(assetIndex, elon.address).amount, 0n);
    assert.equal(
      runtime.getAssetHolding(assetIndex, asaCreator.address).amount,
      initialCreatorHolding.amount + 20n);
  });

  it('should change Permissions SSC Manager if sender is current_permissions_manager', () => {
    // throws error as elon is not permissions manager
    assert.throws(() =>
      whitelist(runtime, elon.account, bob.address, permissionsAppId),
    'RUNTIME_ERR1009: TEAL runtime encountered err opcode');

    const permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
    const currentPermManager = runtime.getAccount(permManagerAddr);
    assert.notEqual(elon.address, currentPermManager.address); // verify elon is not current_perm_manager
    const txn = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: currentPermManager.account, // perm_manager account
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:change_permissions_manager'],
      accounts: [elon.address]
    };

    // works as fromAccount is the current permissions manager
    runtime.executeTx(txn);
    syncAccounts();

    const newPermManager = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
    assert.equal(newPermManager, elon.address); // verify new perm manager is elon
    whitelist(runtime, elon.account, bob.address, permissionsAppId); // passes now

    syncAccounts();
    assert.equal(bob.getLocalState(permissionsAppId, 'whitelisted'), 1n);
  });

  it('should force transfer tokens between non reserve accounts successfully if sender is token manager', () => {
    const permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
    const permManager = runtime.getAccount(permManagerAddr);
    whitelist(runtime, permManager.account, elon.address, permissionsAppId);
    whitelist(runtime, permManager.account, bob.address, permissionsAppId);
    syncAccounts();

    // Opt-In to ASA
    optInToASA(runtime, bob.address, assetIndex);
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();

    // Issue some tokens to sender
    issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // Successful transfer
    const initialElonBalance = runtime.getAssetHolding(assetIndex, elon.address).amount;
    const initialBobBalance = runtime.getAssetHolding(assetIndex, bob.address).amount;
    forceTransfer(runtime, bob, elon, 20, assetIndex,
      controllerAppID, permissionsAppId, lsig, asaManager.account);
    // verify transfer
    assert.equal(
      runtime.getAssetHolding(assetIndex, bob.address).amount,
      initialBobBalance - 20n
    );
    assert.equal(
      runtime.getAssetHolding(assetIndex, elon.address).amount,
      initialElonBalance + 20n
    );
  });

  it('should force transfer tokens without permission checks if receiver is asset reserve', () => {
    // Opt-In to ASA
    optInToASA(runtime, bob.address, assetIndex);
    optInToASA(runtime, elon.address, assetIndex);
    syncAccounts();

    // Issue few tokens to sender
    issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // note that call to permissions is not there
    const forceTxParams = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:force_transfer'],
        foreignAssets: [assetIndex]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsig.address(),
        recipient: asaReserve.address,
        assetID: assetIndex,
        revocationTarget: bob.address,
        amount: 20n,
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        toAccountAddr: lsig.address(),
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      }
    ];
    // Successful transfer
    const initialBobBalance = runtime.getAssetHolding(assetIndex, bob.address).amount;
    const initialReserveBalance = runtime.getAssetHolding(assetIndex, asaReserve.address).amount;
    runtime.executeTx(forceTxParams);
    // verify transfer
    assert.equal(
      runtime.getAssetHolding(assetIndex, bob.address).amount,
      initialBobBalance - 20n
    );
    assert.equal(
      runtime.getAssetHolding(assetIndex, asaReserve.address).amount,
      initialReserveBalance + 20n
    );
  });

  it('should transfer tokens between non reserve accounts successfully', () => {
    fund(runtime, master, lsig.address());
    syncAccounts();
    const amount = 20n;

    // Issue some tokens to Bob and Elon
    optInToASA(runtime, elon.address, assetIndex);
    optInToASA(runtime, bob.address, assetIndex);
    syncAccounts();

    issue(runtime, asaReserve.account, elon, 50, controllerAppID, assetIndex, lsig);
    issue(runtime, asaReserve.account, bob, 50, controllerAppID, assetIndex, lsig);
    syncAccounts();

    // whitelisted both accounts
    const permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
    const permManager = runtime.getAccount(permManagerAddr);
    whitelist(runtime, permManager.account, elon.address, permissionsAppId);
    whitelist(runtime, permManager.account, bob.address, permissionsAppId);
    syncAccounts();
    // verify accounts are whitelisted
    assert.equal(elon.getLocalState(permissionsAppId, 'whitelisted'), 1n);
    assert.equal(bob.getLocalState(permissionsAppId, 'whitelisted'), 1n);

    // transfer 20 tokens from bob -> elon
    const initialElonBalance = runtime.getAssetHolding(assetIndex, elon.address).amount;
    const initialBobBalance = runtime.getAssetHolding(assetIndex, bob.address).amount;
    transfer(runtime, bob, elon, amount, assetIndex, controllerAppID, permissionsAppId, lsig);
    syncAccounts();
    assert.equal(
      runtime.getAssetHolding(assetIndex, bob.address).amount,
      initialBobBalance - amount
    );
    assert.equal(
      runtime.getAssetHolding(assetIndex, elon.address).amount,
      initialElonBalance + amount
    );
  });

  it('should update asset reserve account to another address if sender is asset manager', () => {
    const oldReserveAssetHolding = runtime.getAssetHolding(assetIndex, asaReserve.address);
    const newReserveAddr = elon.address;
    assert.notEqual(asaReserve.address, newReserveAddr); // verify old reserve is not elon.addr

    const updateReserveParams = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        appId: controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:force_transfer'],
        foreignAssets: [assetIndex]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsig.address(),
        recipient: newReserveAddr,
        assetID: assetIndex,
        revocationTarget: asaReserve.address,
        amount: oldReserveAssetHolding.amount, // moving all tokens to new reserve
        lsig: lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        toAccountAddr: lsig.address(),
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.ModifyAsset,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        assetID: assetIndex,
        fields: {
          manager: asaDef.manager,
          reserve: newReserveAddr,
          freeze: asaDef.freeze,
          clawback: lsig.address()
        },
        payFlags: { totalFee: 1000 }
      }
    ];

    optInToASA(runtime, newReserveAddr, assetIndex); // opt-in to ASA by new reserve
    const intialElonHolding = runtime.getAssetHolding(assetIndex, newReserveAddr);

    // execute update tx
    runtime.executeTx(updateReserveParams);
    syncAccounts();

    // verify asa.reserve is updated & old reserve amount is transferred to new reserve
    const newASADef = runtime.getAssetDef(assetIndex);
    assert.equal(newASADef.reserve, elon.address);
    assert.equal(
      runtime.getAssetHolding(assetIndex, elon.address).amount,
      intialElonHolding.amount + oldReserveAssetHolding.amount
    );
  });
});
