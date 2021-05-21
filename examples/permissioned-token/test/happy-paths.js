const { types, AccountStore } = require('@algo-builder/runtime');
const { encodeAddress } = require('algosdk');
const { assert } = require('chai');
const { Context } = require('./common');

const minBalance = 20e6; // 20 ALGOs
const ALICE_ADDRESS = 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY';

describe('Permissioned Token Tests - Happy Paths', function () {
  let master, alice, bob, elon;
  let asaDef, asaReserve, asaManager, asaCreator;
  let ctx;

  this.beforeEach(async function () {
    master = new AccountStore(10000e6);
    alice = new AccountStore(minBalance, { addr: ALICE_ADDRESS, sk: new Uint8Array(0) });
    bob = new AccountStore(minBalance);
    elon = new AccountStore(minBalance);

    ctx = new Context(master, alice, bob, elon);
    asaDef = ctx.getAssetDef();
    asaReserve = ctx.getAccount(asaDef.reserve);
    asaManager = ctx.getAccount(asaDef.manager);
    asaCreator = ctx.getAccount(asaDef.creator);
  });

  it('should issue token if sender is token reserve', () => {
    // Can issue after opting-in
    ctx.optInToASA(elon.address);

    const prevElonAssetHolding = ctx.getAssetHolding(elon.address);
    assert.equal(prevElonAssetHolding.amount, 0n);

    ctx.issue(asaReserve.account, elon, 20);
    ctx.syncAccounts();

    assert.equal(
      ctx.getAssetHolding(elon.address).amount,
      prevElonAssetHolding.amount + 20n
    );
  });

  it('should kill token if sender is token manager', () => {
    assert.equal(ctx.runtime.getGlobalState(ctx.controllerAppID, 'killed'), 0n); // token not killed

    // kill token
    ctx.killToken(asaManager.account);
    ctx.syncAccounts();

    assert.equal(ctx.runtime.getGlobalState(ctx.controllerAppID, 'killed'), 1n); // verify token is killed
    // issuance fails now (as token is killed)
    assert.throws(() =>
      ctx.issue(asaReserve.account, elon, 20),
    'RUNTIME_ERR1009: TEAL runtime encountered err opcode');
  });

  it('should whitelist account if sender is permissions manager', () => {
    // opt-in to permissions ssc by elon
    ctx.optInToPermissionsSSC(elon.address);
    ctx.syncAccounts();
    assert.isDefined(ctx.elon.getAppFromLocal(ctx.permissionsAppId)); // verify opt-in

    const permManagerAddr = encodeAddress(ctx.runtime.getGlobalState(ctx.permissionsAppId, 'manager'));
    const permManager = ctx.getAccount(permManagerAddr);
    ctx.whitelist(permManager.account, elon.address); // whitelist elon
    ctx.syncAccounts();
    assert.equal(ctx.elon.getLocalState(ctx.permissionsAppId, 'whitelisted'), 1n);
  });

  it('should opt-out of token successfully (using closeRemainderTo)', () => {
    // Opt-In
    ctx.optInToASA(elon.address);
    ctx.issue(asaReserve.account, elon, 20);
    ctx.syncAccounts();

    // verify issuance
    assert.equal(
      ctx.getAssetHolding(elon.address).amount,
      20n
    );

    // opt-out issued tokens to creator
    const initialCreatorHolding = ctx.getAssetHolding(asaCreator.address);
    ctx.optOut(asaCreator.address, elon.account);
    ctx.syncAccounts();

    // verify elon and creator's asset holding (after opting out)
    assert.isUndefined(ctx.elon.getAssetHolding(ctx.assetIndex)); // verify asset closed from elon account
    assert.equal(
      ctx.getAssetHolding(asaCreator.address).amount,
      initialCreatorHolding.amount + 20n);
  });

  it('should change Permissions SSC Manager if sender is current_permissions_manager', () => {
    // throws error as elon is not permissions manager
    assert.throws(() =>
      ctx.whitelist(elon.account, bob.address),
    'RUNTIME_ERR1009: TEAL runtime encountered err opcode');

    const permManagerAddr = encodeAddress(ctx.runtime.getGlobalState(ctx.permissionsAppId, 'manager'));
    const currentPermManager = ctx.getAccount(permManagerAddr);
    assert.notEqual(elon.address, currentPermManager.address); // verify elon is not current_perm_manager
    const txn = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: currentPermManager.account, // perm_manager account
      appId: ctx.permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:change_permissions_manager'],
      accounts: [elon.address]
    };

    // works as fromAccount is the current permissions manager
    ctx.runtime.executeTx(txn);
    ctx.syncAccounts();

    const newPermManager = encodeAddress(ctx.runtime.getGlobalState(ctx.permissionsAppId, 'manager'));
    assert.equal(newPermManager, elon.address); // verify new perm manager is elon
    ctx.whitelist(elon.account, bob.address); // passes now

    ctx.syncAccounts();
    assert.equal(ctx.bob.getLocalState(ctx.permissionsAppId, 'whitelisted'), 1n);
  });

  it('should force transfer tokens between non reserve accounts successfully if sender is token manager', () => {
    const permManagerAddr = encodeAddress(ctx.runtime.getGlobalState(ctx.permissionsAppId, 'manager'));
    const permManager = ctx.getAccount(permManagerAddr);
    ctx.whitelist(permManager.account, elon.address);
    ctx.whitelist(permManager.account, bob.address);
    ctx.syncAccounts();

    // Opt-In to ASA
    ctx.optInToASA(bob.address);
    ctx.optInToASA(elon.address);

    // Issue some tokens to sender
    ctx.issue(asaReserve.account, bob, 150);
    ctx.syncAccounts();

    // Successful transfer
    const initialElonBalance = ctx.getAssetHolding(elon.address).amount;
    const initialBobBalance = ctx.getAssetHolding(bob.address).amount;
    ctx.forceTransfer(asaManager.account, bob, elon, 20);
    // verify transfer
    assert.equal(
      ctx.getAssetHolding(bob.address).amount,
      initialBobBalance - 20n
    );
    assert.equal(
      ctx.getAssetHolding(elon.address).amount,
      initialElonBalance + 20n
    );
  });

  it('should force transfer tokens without permission checks if receiver is asset reserve', () => {
    // Opt-In to ASA
    ctx.optInToASA(bob.address);
    ctx.optInToASA(elon.address);

    // Issue few tokens to sender
    ctx.issue(asaReserve.account, bob, 150);
    ctx.syncAccounts();

    // note that call to permissions is not there
    const forceTxParams = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        appId: ctx.controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:force_transfer'],
        foreignAssets: [ctx.assetIndex]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: ctx.lsig.address(),
        recipient: asaReserve.address,
        assetID: ctx.assetIndex,
        revocationTarget: bob.address,
        amount: 20n,
        lsig: ctx.lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        toAccountAddr: ctx.lsig.address(),
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      }
    ];
    // Successful transfer
    const initialBobBalance = ctx.getAssetHolding(bob.address).amount;
    const initialReserveBalance = ctx.getAssetHolding(asaReserve.address).amount;
    ctx.runtime.executeTx(forceTxParams);
    // verify transfer
    assert.equal(
      ctx.getAssetHolding(bob.address).amount,
      initialBobBalance - 20n
    );
    assert.equal(
      ctx.getAssetHolding(asaReserve.address).amount,
      initialReserveBalance + 20n
    );
  });

  it('should transfer tokens between non reserve accounts successfully', () => {
    ctx.syncAccounts();
    const amount = 20n;

    // Issue some tokens to Bob and Elon
    ctx.optInToASA(elon.address);
    ctx.optInToASA(bob.address);
    ctx.issue(asaReserve.account, elon, 50);
    ctx.issue(asaReserve.account, bob, 50);
    ctx.syncAccounts();

    // whitelisted both accounts
    const permManagerAddr = encodeAddress(ctx.runtime.getGlobalState(ctx.permissionsAppId, 'manager'));
    const permManager = ctx.getAccount(permManagerAddr);
    ctx.whitelist(permManager.account, elon.address);
    ctx.whitelist(permManager.account, bob.address);
    ctx.syncAccounts();
    // verify accounts are whitelisted
    assert.equal(ctx.elon.getLocalState(ctx.permissionsAppId, 'whitelisted'), 1n);
    assert.equal(ctx.bob.getLocalState(ctx.permissionsAppId, 'whitelisted'), 1n);

    // transfer 20 tokens from bob -> elon
    const initialElonBalance = ctx.getAssetHolding(elon.address).amount;
    const initialBobBalance = ctx.getAssetHolding(bob.address).amount;
    ctx.transfer(bob, elon, amount);
    ctx.syncAccounts();
    assert.equal(
      ctx.getAssetHolding(bob.address).amount,
      initialBobBalance - amount
    );
    assert.equal(
      ctx.getAssetHolding(elon.address).amount,
      initialElonBalance + amount
    );
  });

  it('should update asset reserve account to another address if sender is asset manager', () => {
    const oldReserveAssetHolding = ctx.getAssetHolding(asaReserve.address);
    const newReserveAddr = elon.address;
    assert.notEqual(asaReserve.address, newReserveAddr); // verify old reserve is not elon.addr

    const updateReserveParams = [
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        appId: ctx.controllerAppID,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:force_transfer'],
        foreignAssets: [ctx.assetIndex]
      },
      {
        type: types.TransactionType.RevokeAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: ctx.lsig.address(),
        recipient: newReserveAddr,
        assetID: ctx.assetIndex,
        revocationTarget: asaReserve.address,
        amount: oldReserveAssetHolding.amount, // moving all tokens to new reserve
        lsig: ctx.lsig,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        toAccountAddr: ctx.lsig.address(),
        amountMicroAlgos: 1000,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.ModifyAsset,
        sign: types.SignType.SecretKey,
        fromAccount: asaManager.account,
        assetID: ctx.assetIndex,
        fields: {
          manager: asaDef.manager,
          reserve: newReserveAddr,
          freeze: asaDef.freeze,
          clawback: ctx.lsig.address()
        },
        payFlags: { totalFee: 1000 }
      }
    ];

    ctx.optInToASA(newReserveAddr); // opt-in to ASA by new reserve
    const intialElonHolding = ctx.getAssetHolding(newReserveAddr);

    // execute update tx
    ctx.runtime.executeTx(updateReserveParams);
    ctx.syncAccounts();

    // verify asa.reserve is updated & old reserve amount is transferred to new reserve
    const newASADef = ctx.getAssetDef();
    assert.equal(newASADef.reserve, elon.address);
    assert.equal(
      ctx.getAssetHolding(elon.address).amount,
      intialElonHolding.amount + oldReserveAssetHolding.amount
    );
  });
});
