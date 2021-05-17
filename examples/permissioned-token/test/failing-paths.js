const { types } = require('@algo-builder/runtime');
const { assert } = require('chai');
const { encodeAddress } = require('algosdk');
const {
  optInToASA,
  optInToPermissionsSSC,
  issue,
  whitelist,
  killToken,
  transfer,
  optOut,
  forceTransfer,
  setupEnv
} = require('./common');

const STR_TRANSFER = 'str:transfer';
const RUNTIME_ERR1009 = 'RUNTIME_ERR1009: TEAL runtime encountered err opcode';
const INDEX_OUT_OF_BOUND_ERR = 'RUNTIME_ERR1008: Index out of bound';
const REJECTED_BY_LOGIC = 'RUNTIME_ERR1007: Teal code rejected by logic';

describe('Permissioned Token Tests - Failing Paths', function () {
  let runtime, master, alice, bob, elon;
  let lsig, assetIndex, controllerAppID, permissionsAppId;
  let asaDef, asaReserve, asaManager;

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
  });

  describe('Token Issuance', function () {
    it('should not issue token if receiver is not opted in', () => {
      assert.throws(() =>
        issue(runtime, asaReserve.account, elon, 20, controllerAppID, assetIndex, lsig),
        `RUNTIME_ERR1404: Account ${elon.address} doesn't hold asset index ${assetIndex}`);
    });

    it('should not issue if token is killed', () => {
      // Opt-in to ASA by receiver
      optInToASA(runtime, elon.address, assetIndex);
      syncAccounts();

      killToken(runtime, asaManager.account, controllerAppID);
      assert.throws(() =>
        issue(runtime, asaReserve.account, elon, 20, controllerAppID, assetIndex, lsig),
      RUNTIME_ERR1009);
    });

    it('should reject issuance tx if sender is not token reserve', () => {
      // Opt-in to ASA by receiver
      optInToASA(runtime, elon.address, assetIndex);
      syncAccounts();

      assert.throws(() =>
        issue(runtime, bob.account, elon, 20, controllerAppID, assetIndex, lsig),
      RUNTIME_ERR1009);
    });

    it('should reject issuance tx if trying to send asset using secret key instead of clawback', () => {
      // Opt-in to ASA by receiver
      optInToASA(runtime, elon.address, assetIndex);
      syncAccounts();

      const txParams = {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: asaReserve.account,
        toAccountAddr: elon.address,
        amount: 20n,
        assetID: assetIndex,
        payFlags: {}
      };

      // should fail as we can only use clawback (since asset is default-frozen)
      assert.throws(() =>
        runtime.executeTx(txParams),
        `RUNTIME_ERR1505: Asset index ${assetIndex} frozen for account ${elon.address}`);
    });
  });

  describe('Kill Token', function () {
    it('should reject tx to kill token if sender is not token manager', () => {
      // verify bob is not token manager
      assert.notEqual(asaManager.address, bob.address);
      // bob trying to kill token
      assert.throws(() =>
        killToken(runtime, bob.account, controllerAppID),
      RUNTIME_ERR1009);
    });
  });

  describe('WhiteListing', function () {
    let permManagerAddr, permManager, whitelistParams;
    this.beforeEach(() => {
      permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
      permManager = runtime.getAccount(permManagerAddr);

      whitelistParams = {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: permManager.account,
        appId: permissionsAppId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:add_whitelist'],
        accounts: [elon.address]
      };
    });

    it('should reject whitelist if account is not opted in to permissions', () => {
      // verify account not opted in
      assert.isUndefined(elon.getAppFromLocal(permissionsAppId));

      // Fails because elon is not opted in
      assert.throws(() =>
        runtime.executeTx({ ...whitelistParams }),
        `RUNTIME_ERR1306: Application Index ${permissionsAppId} not found or is invalid`);
    });

    it('should not whitelist account if sender is not current permissions manager', () => {
      // opt-in to permissions by elon
      optInToPermissionsSSC(runtime, elon.address, permissionsAppId);
      syncAccounts();
      assert.isDefined(elon.getAppFromLocal(permissionsAppId));

      // Fails because Bob is not the manager
      assert.notEqual(permManager.address, bob.address); // verify bob is not permissions manager
      assert.throws(() => runtime.executeTx({
        ...whitelistParams,
        fromAccount: bob.account // Bob is not the asset manager
      }), RUNTIME_ERR1009);
    });
  });

  describe('Opt Out', function () {
    it('should reject tx if user not opted-in', () => {
      const asaCreator = runtime.getAccount(asaDef.creator);
      assert.throws(() =>
        optOut(runtime, asaCreator.address, elon.account, assetIndex),
        `RUNTIME_ERR1404: Account ${elon.address} doesn't hold asset index ${assetIndex}`);
    });
  });

  describe('Change Permissions Manager', function () {
    it('should fail if sender is not current permissions manager', () => {
      const permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
      const permManager = runtime.getAccount(permManagerAddr);
      assert.notEqual(permManager.address, bob.address); // verify bob is not current permissions manager

      const txParams = {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        appId: permissionsAppId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:change_permissions_manager'],
        accounts: [elon.address]
      };
      assert.throws(() =>
        runtime.executeTx(txParams), // fails as fromAccount is not the current permissions manager
      RUNTIME_ERR1009);
    });
  });

  describe('Force Transfer(Clawback)', function () {
    let permManagerAddr, permManager, forceTransferGroup;
    this.beforeEach(() => {
      permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
      permManager = runtime.getAccount(permManagerAddr);

      // Opt-In to ASA by bob and elon (accA, accB)
      optInToASA(runtime, bob.address, assetIndex);
      optInToASA(runtime, elon.address, assetIndex);
      syncAccounts();

      // transaction group for forced token transfer between two non-reserve accounts
      // note that sender is asa.manager
      forceTransferGroup = [
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
          recipient: elon.address,
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
        },
        {
          type: types.TransactionType.CallNoOpSSC,
          sign: types.SignType.SecretKey,
          fromAccount: asaManager.account,
          appId: permissionsAppId,
          payFlags: { totalFee: 1000 },
          appArgs: [STR_TRANSFER],
          accounts: [bob.address, elon.address]
        }
      ];
    });

    it('Should fail on force transfer if transaction group is not valid', () => {
      const forceTxGroup = [...forceTransferGroup];

      // fails as permissions is not called
      assert.throws(() =>
        runtime.executeTx([forceTxGroup[0], forceTxGroup[1], forceTxGroup[2]]),
      INDEX_OUT_OF_BOUND_ERR
      );

      // fails if only trying to use clawback transaction to transfer asset
      assert.throws(() =>
        runtime.executeTx(forceTxGroup[1]),
      INDEX_OUT_OF_BOUND_ERR
      );

      // fails as paying fees of clawback-escrow is skipped
      assert.throws(() =>
        runtime.executeTx([forceTxGroup[0], forceTxGroup[1], forceTxGroup[3]]),
      INDEX_OUT_OF_BOUND_ERR
      );

      // fails as controller is not called
      assert.throws(() =>
        runtime.executeTx([forceTxGroup[1], forceTxGroup[2], forceTxGroup[3]]),
      REJECTED_BY_LOGIC
      );
    });

    it('should reject transfer if transaction group is valid but controller.sender is not equal to asset.sender', () => {
      const forceTxGroup = [...forceTransferGroup];
      forceTxGroup[0].fromAccount = elon.account;

      assert.throws(() =>
        runtime.executeTx(forceTxGroup),
      RUNTIME_ERR1009
      );
    });

    it('Should reject transfer is sender is not token manager', () => {
      // Opt-In to permissions SSC & Whitelist
      whitelist(runtime, permManager.account, elon.address, permissionsAppId);
      whitelist(runtime, permManager.account, bob.address, permissionsAppId);
      syncAccounts();

      // Issue some tokens to sender
      issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
      syncAccounts();

      // Fails as only asset manager(alice) can perform force transfer
      assert.notEqual(asaManager.address, bob.address);
      assert.throws(() =>
        forceTransfer(runtime, bob, elon, 20, assetIndex,
          controllerAppID, permissionsAppId, lsig, bob.account),
      RUNTIME_ERR1009
      );
    });

    it('Should reject force transfer if accounts are not whitelisted', () => {
      // Issue some tokens to sender
      issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
      syncAccounts();

      // Fails as both sender, receiver are not whitelisted
      assert.throws(() =>
        forceTransfer(runtime, bob, elon, 20, assetIndex, controllerAppID,
          permissionsAppId, lsig, asaManager.account),
      RUNTIME_ERR1009
      );

      // still fails as sender is whitelisted but receiver is not
      whitelist(runtime, permManager.account, bob.address, permissionsAppId);
      syncAccounts();
      assert.throws(() =>
        forceTransfer(runtime, bob, elon, 20, assetIndex, controllerAppID,
          permissionsAppId, lsig, asaManager.account),
      RUNTIME_ERR1009
      );

      // passes now as both sender, receiver are whitelisted
      whitelist(runtime, permManager.account, elon.address, permissionsAppId);
      syncAccounts();
      forceTransfer(runtime, bob, elon, 20, assetIndex, controllerAppID,
        permissionsAppId, lsig, asaManager.account);
    });

    it('Should reject force transfer if accounts are whitelisted but receiver balance becomes > 100', () => {
      // Opt-In to permissions SSC & Whitelist
      whitelist(runtime, permManager.account, elon.address, permissionsAppId);
      whitelist(runtime, permManager.account, bob.address, permissionsAppId);
      syncAccounts();

      // Issue some tokens to sender
      issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
      syncAccounts();

      // Fails as receiver balance becomes > 100 now
      assert.throws(() =>
        forceTransfer(runtime, bob, elon, 110, assetIndex, controllerAppID,
          permissionsAppId, lsig, asaManager.account),
      RUNTIME_ERR1009
      );
    });

    it('Should reject force transfer if token is killed', () => {
      // Opt-In to permissions SSC & Whitelist
      whitelist(runtime, permManager.account, elon.address, permissionsAppId);
      whitelist(runtime, permManager.account, bob.address, permissionsAppId);
      syncAccounts();

      // Issue some tokens to sender and kill token
      issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
      killToken(runtime, asaManager.account, controllerAppID);
      syncAccounts();

      // fails as accounts are whitelisted, amount is good but token is killed
      assert.throws(() =>
        forceTransfer(runtime, bob, elon, 20, assetIndex, controllerAppID,
          permissionsAppId, lsig, asaManager.account),
      RUNTIME_ERR1009
      );
    });
  });

  describe('Token Transfer', function () {
    let permManagerAddr, permManager, tokenTransferGroup;
    this.beforeEach(() => {
      permManagerAddr = encodeAddress(runtime.getGlobalState(permissionsAppId, 'manager'));
      permManager = runtime.getAccount(permManagerAddr);

      // Opt-In to ASA by bob and elon (accA, accB)
      optInToASA(runtime, bob.address, assetIndex);
      optInToASA(runtime, elon.address, assetIndex);
      syncAccounts();

      // transaction group for token transfer between two non-reserve accounts
      tokenTransferGroup = [
        {
          type: types.TransactionType.CallNoOpSSC,
          sign: types.SignType.SecretKey,
          fromAccount: bob.account,
          appId: controllerAppID,
          payFlags: { totalFee: 1000 },
          appArgs: [STR_TRANSFER],
          foreignAssets: [assetIndex]
        },
        {
          type: types.TransactionType.RevokeAsset,
          sign: types.SignType.LogicSignature,
          fromAccountAddr: lsig.address(),
          recipient: elon.address,
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
        },
        {
          type: types.TransactionType.CallNoOpSSC,
          sign: types.SignType.SecretKey,
          fromAccount: bob.account,
          appId: permissionsAppId,
          payFlags: { totalFee: 1000 },
          appArgs: [STR_TRANSFER],
          accounts: [bob.address, elon.address]
        }
      ];
    });

    it('Should fail if transaction group is not valid', () => {
      const txGroup = [...tokenTransferGroup];

      // fails as permissions is not called
      assert.throws(() =>
        runtime.executeTx([txGroup[0], txGroup[1], txGroup[2]]),
      INDEX_OUT_OF_BOUND_ERR
      );

      // fails if only trying to use clawback transaction to transfer asset
      assert.throws(() =>
        runtime.executeTx(txGroup[1]),
      INDEX_OUT_OF_BOUND_ERR
      );

      // fails as paying fees of clawback-escrow is skipped
      assert.throws(() =>
        runtime.executeTx([txGroup[0], txGroup[1], txGroup[3]]),
      INDEX_OUT_OF_BOUND_ERR
      );

      // fails as controller is not called (rejected by clawback)
      assert.throws(() =>
        runtime.executeTx([txGroup[1], txGroup[2], txGroup[3]]),
      REJECTED_BY_LOGIC
      );
    });

    it('should reject transfer if transaction group is valid but controller.sender is not equal to asset.sender', () => {
      const txGroup = [...tokenTransferGroup];
      txGroup[0].fromAccount = elon.account;

      assert.throws(() =>
        runtime.executeTx(txGroup),
      RUNTIME_ERR1009
      );
    });

    it('should reject transfer if sender trying to transfer token using secret key instead of clawback', () => {
      const assetTransferParams = {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        toAccountAddr: elon.address,
        amount: 20n,
        assetID: assetIndex,
        payFlags: {}
      };

      // should fail as we can only use clawback (since asset is default-frozen)
      assert.throws(() =>
        runtime.executeTx(assetTransferParams),
        `RUNTIME_ERR1505: Asset index ${assetIndex} frozen for account ${bob.address}`);
    });

    it('Should reject transfer if accounts are not whitelisted', () => {
      // Issue some tokens to sender
      issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
      syncAccounts();

      // Fails as both sender, receiver are not whitelisted
      assert.throws(() =>
        transfer(runtime, bob, elon, 20, assetIndex, controllerAppID, permissionsAppId, lsig),
      RUNTIME_ERR1009
      );

      // still fails as sender is whitelisted but receiver is not
      whitelist(runtime, permManager.account, bob.address, permissionsAppId);
      syncAccounts();
      assert.throws(() =>
        transfer(runtime, bob, elon, 20, assetIndex, controllerAppID, permissionsAppId, lsig),
      RUNTIME_ERR1009
      );

      // passes now as both sender, receiver are whitelisted
      whitelist(runtime, permManager.account, elon.address, permissionsAppId);
      syncAccounts();
      transfer(runtime, bob, elon, 20, assetIndex, controllerAppID, permissionsAppId, lsig);
    });

    it('Should reject force transfer if accounts are whitelisted but receiver balance becomes > 100', () => {
      // Opt-In to permissions SSC & Whitelist
      whitelist(runtime, permManager.account, elon.address, permissionsAppId);
      whitelist(runtime, permManager.account, bob.address, permissionsAppId);
      syncAccounts();

      // Issue some tokens to sender
      issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
      syncAccounts();

      // Fails as receiver balance becomes > 100 now
      assert.throws(() =>
        transfer(runtime, bob, elon, 105, assetIndex, controllerAppID, permissionsAppId, lsig),
      RUNTIME_ERR1009
      );
    });

    it('should reject transfer if rules are followed, but token is killed', () => {
      // Opt-In to permissions SSC & Whitelist
      whitelist(runtime, permManager.account, elon.address, permissionsAppId);
      whitelist(runtime, permManager.account, bob.address, permissionsAppId);
      syncAccounts();

      // Issue some tokens to sender & kill token
      issue(runtime, asaReserve.account, bob, 150, controllerAppID, assetIndex, lsig);
      killToken(runtime, asaManager.account, controllerAppID);
      syncAccounts();

      // fails as accounts are whitelisted, amount is good but token is killed
      assert.throws(() =>
        transfer(runtime, bob, elon, 10, assetIndex, controllerAppID, permissionsAppId, lsig),
      RUNTIME_ERR1009
      );
    });
  });

  describe('Update token reserve', function () {
    let updateReserveParams;
    this.beforeEach(() => {
      const oldReserveAssetHolding = runtime.getAssetHolding(assetIndex, asaReserve.address);
      const newReserveAddr = elon.address;
      optInToASA(runtime, newReserveAddr, assetIndex);

      // transaction group to update reserve account
      updateReserveParams = [
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
    });

    it('Should fail if transaction group is not valid', () => {
      const txGroup = [...updateReserveParams];

      // fails as paying fees of clawback-escrow is skipped
      assert.throws(() =>
        runtime.executeTx([txGroup[0], txGroup[1], txGroup[3]]),
      INDEX_OUT_OF_BOUND_ERR
      );

      // fails as controller is not called (rejected by clawback)
      assert.throws(() =>
        runtime.executeTx([txGroup[1], txGroup[2], txGroup[3]]),
      REJECTED_BY_LOGIC
      );
    });

    it('should reject update if controller.sender is not asset manager', () => {
      const txGroup = [...updateReserveParams];
      txGroup[0].fromAccount = bob.account;

      // fails as controller's sender is not asset manager
      assert.notEqual(asaManager.address, bob.address);
      assert.throws(() =>
        runtime.executeTx(txGroup),
      RUNTIME_ERR1009
      );
    });

    it('should reject update if sender of asset config tx is not asset manager', () => {
      const txGroup = [...updateReserveParams];
      txGroup[3].fromAccount = bob.account;

      // fails as controller's sender is not asset manager
      assert.notEqual(asaManager.address, bob.address);
      assert.throws(() =>
        runtime.executeTx(txGroup),
        `RUNTIME_ERR1504: Only Manager account ${asaManager.address} can modify asset`
      );
    });
  });
});
