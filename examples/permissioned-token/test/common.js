const {
  getProgram
} = require('@algo-builder/algob');
const { Runtime, AccountStore, types } = require('@algo-builder/runtime');

const minBalance = 20e6; // 20 ALGOs

const CLAWBACK = 'clawback.py';
const CONTROLLER = 'controller.py';
const PERMISSIONS = 'permissions.py';
const CLEAR_STATE = 'clear_state_program.py';

const ALICE_ADDRESS = 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY';

let master = new AccountStore(10000e6);
let alice, bob, elon;
let runtime;
let assetIndex;
let lsig;
let controllerAppID, permissionsAppId;

let CLAWBACK_PROGRAM;
let CONTROLLER_PROGRAM;
let PERMISSIONS_PROGRAM;
const CLEAR_STATE_PROGRAM = getProgram(CLEAR_STATE);

const TRANSFER = 'str:transfer';

// Sync Accounts
function syncAccounts (runtime) {
  master = runtime.getAccount(master.address);
  alice = runtime.getAccount(alice.address);
  bob = runtime.getAccount(bob.address);
  elon = runtime.getAccount(elon.address);
}

// Opt-In account to ASA
function optInToASA (runtime, address, assetIndex) {
  runtime.optIntoASA(assetIndex, address, {});
}

// Opt-In address to Permissions SSC
function optInToPermissions (runtime, address, permissionsAppId) {
  runtime.optInToApp(address, permissionsAppId, {}, {});
}

/**
 * Issue some tokens to the passed account
 * @param runtime RuntimeEnv Instance
 * @param manager ASA Manager Account
 * @param receiver Receiver Account
 * @param amount Amount
 * @param controllerAppID Controller App ID
 * @param assetIndex ASA ID (Token ID)
 * @param lsig (Clawback LSig)
 */
function issue (runtime, manager, receiver, amount, controllerAppID, assetIndex, lsig) {
  const txns = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: manager.account,
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
      revocationTarget: manager.address,
      amount: amount,
      lsig: lsig,
      payFlags: { totalFee: 1000 }
    }
  ];
  runtime.executeTx(txns);
}

/**
 * Kill the token
 * @param runtime RuntimeEnv Instance
 * @param manager ASA Manager Account
 * @param controllerAppID Controller App ID
 */
function killToken (runtime, manager, controllerAppID) {
  runtime.executeTx({
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: manager.account,
    appId: controllerAppID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:kill'],
    foreignAssets: [assetIndex]
  });
}

/**
 * Whitelists the passed address for allowing token transfer
 * @param runtime RuntimeEnv Instance
 * @param manager ASA Manager Account
 * @param address Address to be whitelisted
 * @param assetIndex ASA ID
 * @param controllerAppID Controller App ID
 * @param permissionsAppId Permissions App ID
 */
function whitelist (runtime, manager, address, assetIndex, controllerAppID, permissionsAppId) {
  optInToPermissions(runtime, address, permissionsAppId);
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
      appArgs: [TRANSFER],
      accounts: [to.address]

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
      appArgs: [TRANSFER],
      accounts: [from.address, to.address]
    }
  ];
  runtime.executeTx(txGroup);
}

/**
 * Performs Opt-Out operation
 * @param runtime RuntimeEnv
 * @param manager ASA Manager Account
 * @param opAccount Account to be Opted-Out
 * @param assetIndex ASA ID
 */
function optOut (runtime, manager, opAccount, assetIndex) {
  const optOutParams = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: opAccount.account,
    toAccountAddr: opAccount.address,
    assetID: assetIndex,
    amount: 0,
    payFlags: { totalFee: 1000, closeRemainderTo: manager.address }
  };
  runtime.executeTx(optOutParams);
}

/**
 * Force Transfer Tokens
 * @param runtime RuntimeEnv Instance
 * @param from Sender Account
 * @param to Receiver Account
 * @param amount Amount
 * @param assetIndex ASA ID
 * @param controllerAppID Controller App ID
 * @param permissionsAppId Permissions App ID
 * @param lsig Clawback LSig
 * @param manager ASA Manager Account
 */
function forceTransfer (
  runtime, from, to, amount, assetIndex, controllerAppID, permissionsAppId, lsig, manager) {
  const txGroup = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: manager.account,
      appId: controllerAppID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:force_transfer'],
      accounts: [to.address],
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
      fromAccount: manager.account,
      toAccountAddr: lsig.address(),
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    },
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: manager.account,
      appId: permissionsAppId,
      payFlags: { totalFee: 1000 },
      appArgs: [TRANSFER],
      accounts: [from.address, to.address]
    }
  ];
  runtime.executeTx(txGroup);
}

function setupEnv () {
  // Create Accounts and Env
  alice = new AccountStore(minBalance, { addr: ALICE_ADDRESS, sk: new Uint8Array(0) });
  bob = new AccountStore(minBalance);
  elon = new AccountStore(minBalance);
  runtime = new Runtime([master, alice, bob, elon]);

  // Deploy ASA
  assetIndex = runtime.addAsset('gold', { creator: { ...alice.account, name: 'alice' } });
  const asaDef = runtime.getAssetDef(assetIndex);

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
  fund(runtime, master, lsig.address());
  runtime.executeTx({
    type: types.TransactionType.ModifyAsset,
    sign: types.SignType.SecretKey,
    fromAccount: alice.account,
    assetID: assetIndex,
    fields: {
      manager: asaDef.manager,
      reserve: asaDef.reserve,
      freeze: asaDef.freeze,
      clawback: lsig.address()
    },
    payFlags: { totalFee: 1000 }
  });
  optInToASA(runtime, lsig.address(), assetIndex);

  syncAccounts(runtime);

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

  // Refresh Accounts
  syncAccounts(runtime);

  return [
    runtime,
    master,
    alice,
    bob,
    elon,
    assetIndex,
    controllerAppID,
    lsig,
    permissionsAppId
  ];
};

module.exports = {
  optInToASA: optInToASA,
  optInToPermissions: optInToPermissions,
  issue: issue,
  killToken: killToken,
  whitelist: whitelist,
  fund: fund,
  transfer: transfer,
  optOut: optOut,
  forceTransfer: forceTransfer,
  setupEnv: setupEnv
};
