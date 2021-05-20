const {
  getProgram
} = require('@algo-builder/algob');
const { Runtime, types } = require('@algo-builder/runtime');

const minBalance = 20e6; // 20 ALGOs
const CLAWBACK_STATELESS_PROGRAM = 'clawback.py';
const CONTROLLER_APPROVAL_PROGRAM = 'controller.py';
const PERMISSIONS_APPROVAL_PROGRAM = 'permissions.py';
const CLEAR_STATE_PROGRAM = 'clear_state_program.py';

const TRANSFER_ARG = 'str:transfer';

class Context {
  /**
   * Properties of Context:
   * - master;
   * - alice;
   * - bob;
   * - elon;
   * - runtime;
   * - assetIndex;
   * - lsig;
   * - controllerAppID;
   * - permissionsAppId;
   */

  /**
   * - Setup token (ASA gold)
   * - Setup Controller asc
   * - Setup asset clawback + update asset clawback to escrow contract
   * - Setup permissions smart contract
   * NOTE: During setup - ASA.reserve, ASA.manager & current_permissions_manager is set as alice.address
   */
  constructor (master, alice, bob, elon) {
    this.master = master;
    this.alice = alice;
    this.bob = bob;
    this.elon = elon;
    this.runtime = new Runtime([master, alice, bob, elon]);
    this.deployASA('gold', { ...alice.account, name: 'alice' });
    this.deployController(alice, CONTROLLER_APPROVAL_PROGRAM, CLEAR_STATE_PROGRAM);
    this.deployClawback(alice, CLAWBACK_STATELESS_PROGRAM);
    this.deployPermissions(alice, PERMISSIONS_APPROVAL_PROGRAM, CLEAR_STATE_PROGRAM);
    this.syncAccounts();
  }

  // refresh state
  syncAccounts () {
    this.alice = this.getAccount(this.alice.address);
    this.bob = this.getAccount(this.bob.address);
    this.elon = this.getAccount(this.elon.address);
  }

  deployASA (name, creator) {
    this.assetIndex = this.runtime.addAsset(name, { creator: creator });
  }

  deployController (sender, approvalProgram, clearStateProgram) {
    const sscFlags = {
      sender: sender.account,
      localInts: 0,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 0,
      foreignAssets: [this.assetIndex]
    };
    const controllerProgram = getProgram(approvalProgram, { TOKEN_ID: this.assetIndex });
    const clearProgram = getProgram(clearStateProgram);
    this.controllerAppID = this.runtime.addApp(
      sscFlags, {}, controllerProgram, clearProgram
    );
  }

  // Deploy Clawback Lsig and Modify Asset
  deployClawback (sender, clawbackProgram) {
    const clawbackTeal = getProgram(clawbackProgram, {
      TOKEN_ID: this.assetIndex,
      CONTROLLER_APP_ID: this.controllerAppID
    });
    this.lsig = this.runtime.getLogicSig(clawbackTeal, []);

    fund(this.runtime, this.master, this.lsig.address());
    const asaDef = this.runtime.getAssetDef(this.assetIndex);
    // modify asset clawback
    this.runtime.executeTx({
      type: types.TransactionType.ModifyAsset,
      sign: types.SignType.SecretKey,
      fromAccount: sender.account,
      assetID: this.assetIndex,
      fields: {
        manager: asaDef.manager,
        reserve: asaDef.reserve,
        freeze: asaDef.freeze,
        clawback: this.lsig.address()
      },
      payFlags: { totalFee: 1000 }
    });
    this.optInToASA(this.lsig.address());
  }

  deployPermissions (permManager, approvalProgram, clearStateProgram) {
    const permissionsProgram = getProgram(approvalProgram, { PERM_MANAGER: permManager.address });
    const clearProgram = getProgram(clearStateProgram);

    const sscFlags = {
      sender: permManager.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 1,
      appArgs: [`int:${this.controllerAppID}`]
    };
    this.permissionsAppId = this.runtime.addApp(
      sscFlags, {}, permissionsProgram, clearProgram
    );

    // set permissions SSC app_id in controller ssc
    const appArgs = [
      'str:set_permission',
      `int:${this.permissionsAppId}`
    ];
    this.runtime.executeTx({
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: this.alice.account,
      appId: this.controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: appArgs,
      foreignAssets: [this.assetIndex]
    });
  }

  getAccount (address) {
    return this.runtime.getAccount(address);
  }

  getAssetDef () {
    return this.runtime.getAssetDef(this.assetIndex);
  }

  getAssetHolding (address) {
    return this.runtime.getAssetHolding(this.assetIndex, address);
  }

  // Opt-In account to ASA
  optInToASA (address) {
    this.runtime.optIntoASA(this.assetIndex, address, {});
  }

  // Opt-In address to Permissions SSC
  optInToPermissionsSSC (address) {
    this.runtime.optInToApp(address, this.permissionsAppId, {}, {});
  }

  issue (asaReserve, receiver, amount) {
    issue(this.runtime, asaReserve, receiver, amount,
      this.controllerAppID, this.assetIndex, this.lsig);
  }

  killToken (asaManager) {
    killToken(this.runtime, asaManager, this.controllerAppID, this.assetIndex);
  }

  whitelist (permManager, addrToWhitelist) {
    this.optInToPermissionsSSC(addrToWhitelist);
    whitelist(this.runtime, permManager, addrToWhitelist, this.permissionsAppId);
  }

  transfer (from, to, amount) {
    transfer(this.runtime, from, to, amount, this.assetIndex,
      this.controllerAppID, this.permissionsAppId, this.lsig);
  }

  optOut (asaCreatorAddr, account) {
    optOut(this.runtime, asaCreatorAddr, account, this.assetIndex);
  }

  forceTransfer (asaManager, from, to, amount) {
    forceTransfer(this.runtime, asaManager, from, to, amount,
      this.assetIndex, this.controllerAppID, this.permissionsAppId, this.lsig);
  }
}

/**
 * Issue some tokens to the passed account
 * @param runtime RuntimeEnv Instance
 * @param asaReserve ASA Reserve Account
 * @param receiver Receiver Account
 * @param amount Amount
 * @param controllerAppID Controller App ID
 * @param assetIndex ASA ID (Token ID)
 * @param lsig (Clawback LSig)
 */
function issue (runtime, asaReserve, receiver, amount, controllerAppID, assetIndex, lsig) {
  const txns = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: asaReserve,
      appId: controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:issue'],
      foreignAssets: [assetIndex]
    },
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      recipient: receiver.address,
      assetID: assetIndex,
      revocationTarget: asaReserve.addr,
      amount: amount,
      lsig: lsig,
      payFlags: { totalFee: 1000 }
    }
  ];
  runtime.executeTx(txns);
}

/**
 * Kill the tokenfunction killToken (runtime, asaManager, controllerAppID) {
 * @param runtime RuntimeEnv Instance
 * @param asaManager ASA Manager Account
 * @param controllerAppID Controller App ID
 * @param assetIndex token index to be killed
 */
function killToken (runtime, asaManager, controllerAppID, assetIndex) {
  runtime.executeTx({
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: asaManager,
    appId: controllerAppID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:kill'],
    foreignAssets: [assetIndex]
  });
}

/**
 * Whitelists the passed address for allowing token transfer
 * @param runtime RuntimeEnv Instance
 * @param permManager Permissions Manager Account
 * @param addrToWhitelist Address to be whitelisted
 * @param permissionsAppId Permissions App ID
 */
function whitelist (runtime, permManager, addrToWhitelist, permissionsAppId) {
  runtime.executeTx({
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: permManager,
    appId: permissionsAppId,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:add_whitelist'],
    accounts: [addrToWhitelist]
  });
}

/**
 * Fund the address with min ALGOs(20)
 * @param runtime RuntimeEnv Instance
 * @param master Master Account
 * @param address Receiver Account Address
 */
function fund (runtime, master, address) {
  runtime.executeTx({
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: master.account,
    toAccountAddr: address,
    amountMicroAlgos: minBalance,
    payFlags: {}
  });
}

/**
 * Transfer ASA
 * @param runtime RuntimeEnv Instance
 * @param from Sender Account
 * @param to Receiver Account
 * @param amount Amount
 * @param assetIndex ASA ID
 * @param controllerAppID Controller App ID
 * @param permissionsAppId Permissions App ID
 * @param lsig Clawback LSig
 */
function transfer (runtime, from, to, amount, assetIndex, controllerAppID, permissionsAppId, lsig) {
  const txGroup = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: from.account,
      appId: controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: [TRANSFER_ARG]
    },
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
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
      toAccountAddr: lsig.address(),
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    },
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: from.account,
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: [TRANSFER_ARG],
      accounts: [from.address, to.address]
    }
  ];
  runtime.executeTx(txGroup);
}

/**
 * Performs Opt-Out operation
 * @param runtime RuntimeEnv
 * @param asaCreatorAddr ASA Creator Address
 * @param account Account to be Opted-Out
 * @param assetIndex ASA ID
 */
function optOut (runtime, asaCreatorAddr, account, assetIndex) {
  const optOutParams = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: account,
    toAccountAddr: account.addr,
    assetID: assetIndex,
    amount: 0,
    payFlags: { totalFee: 1000, closeRemainderTo: asaCreatorAddr }
  };
  runtime.executeTx(optOutParams);
}

/**
 * Force Transfer Tokens
 * @param runtime RuntimeEnv Instance
 * @param asaManager ASA Manager Account
 * @param from Sender Account
 * @param to Receiver Account
 * @param amount Amount
 * @param assetIndex ASA ID
 * @param controllerAppID Controller App ID
 * @param permissionsAppId Permissions App ID
 * @param lsig Clawback LSig
 */
function forceTransfer (
  runtime, asaManager, from, to, amount, assetIndex, controllerAppID, permissionsAppId, lsig) {
  const txGroup = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: asaManager,
      appId: controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:force_transfer'],
      foreignAssets: [assetIndex]
    },
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
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
      fromAccount: asaManager,
      toAccountAddr: lsig.address(),
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    },
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: asaManager,
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: [TRANSFER_ARG],
      accounts: [from.address, to.address]
    }
  ];
  runtime.executeTx(txGroup);
}

module.exports = {
  Context: Context
};
