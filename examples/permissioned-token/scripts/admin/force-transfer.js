const {
  balanceOf, executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

const accounts = require('../common/accounts');
const { getClawback, fundAccount, optInAccountToApp } = require('../common/common');
const { issue } = require('./issue');
const { whitelist } = require('../permissions/whitelist');

const clearStateProgram = 'clear_state_program.py';

/**
 * Force transfer tokens between 2 accounts by (signed by token manager)
 * @param from fromAccountAddress
 * @param to toAccountAddress
 * @param {number} amount units of token to transfer
 */
async function forceTransfer (deployer, fromAddr, toAddr, amount) {
  const owner = deployer.accountsByName.get(accounts.owner);
  const tesla = deployer.asa.get('tesla');
  const controllerAppInfo = deployer.getApp('controller.py', clearStateProgram);
  const permissionsAppInfo = deployer.getApp('permissions.py', clearStateProgram);

  const clawbackLsig = await getClawback(deployer);
  const clawbackAddress = clawbackLsig.address();

  // notice the difference in calls here: stateful calls are done by token manager here
  // and from, to address are only used in asset transfer tx
  const forceTxGroup = [
    /*
     * tx 0 - Call to controller stateful smart contract (by ASA.manager)
     * with application arg: 'force_transfer'. The contract ensures that there
     * is a call to permissions smart contract in the txGroup, so that rules
     * are checked during token transfer. */
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: owner,
      appID: controllerAppInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:force_transfer'],
      foreignAssets: [tesla.assetIndex] // to verify token reserve, manager
    },
    /*
     * tx 1 - Asset transfer transaction from sender -> receiver. This tx is executed
     * and approved by the clawback lsig (clawback.teal). The clawback lsig address is the
     * address which transfers the frozen asset (amount = amount) from accA to accB.
     * Clawback ensures a call to controller smart contract during token transfer. */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: clawbackAddress,
      recipient: toAddr,
      assetID: tesla.assetIndex,
      revocationTarget: fromAddr,
      amount: amount,
      lsig: clawbackLsig,
      payFlags: { totalFee: 1000 }
    },
    /*
     * tx 2 - Payment transaction of 1000 microAlgo to cover clawback transaction cost (tx 1).
     * NOTE: It can be signed by any account, but it should be present in group. */
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: owner,
      toAccountAddr: clawbackAddress,
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    },
    /*
     * tx 3 - Call to permissions stateful smart contract with application arg: 'transfer' */
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: owner,
      appID: permissionsAppInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:transfer'],
      accounts: [fromAddr, toAddr], //  AppAccounts (pass asset sender & receiver address)
      foreignAssets: [tesla.assetIndex] // from TEALv4 ASA reference must be passed in assets array
    }
  ];

  console.log(`* Transferring ${amount} tokens from
    [${fromAddr}] to [${toAddr}] *`);
  await executeTransaction(deployer, forceTxGroup);

  console.log(`* ${toAddr}(receiver) asset holding: *`);
  console.log(await balanceOf(deployer, toAddr, tesla.assetIndex));

  console.log('* Transfer Successful *');
}

// similar to transfer.js, but tokens are transferred by the token manager in this case
async function run (runtimeEnv, deployer) {
  const owner = deployer.accountsByName.get(accounts.owner);
  const permissionsManager = owner;
  const permissionsAppInfo = deployer.getApp('permissions.py', clearStateProgram);

  /*
   * Force transfer some tokens b/w 2 accounts
   */
  const bob = deployer.accountsByName.get('bob');
  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  await fundAccount(deployer, [john, bob, elon]);

  // opt-in accounts to permissions smart contract
  // comment this code if already opted-in
  await Promise.all([
    optInAccountToApp(deployer, elon, permissionsAppInfo.appID, {}, {}),
    optInAccountToApp(deployer, bob, permissionsAppInfo.appID, {}, {}),
    optInAccountToApp(deployer, john, permissionsAppInfo.appID, {}, {})
  ]);

  /*
   * use below function to whitelist accounts
   * check ../permissions/whitelist.js to see whitelisting accounts
   * comment below code if [from, to] accounts are already whitelisted
   * NOTE: whitelist() transaction will be executed by the permissionsManager,
   * current_user (a non reserve account) will not control permissionsManager account.
   */
  await whitelist(deployer, permissionsManager, bob.addr);
  await whitelist(deployer, permissionsManager, john.addr);

  // opt-in accounts to asa 'tesla' (so they can receive the asset)
  await Promise.all([
    deployer.optInAccountToASA('tesla', elon.name, {}),
    deployer.optInAccountToASA('tesla', bob.name, {}),
    deployer.optInAccountToASA('tesla', john.name, {})
  ]);

  // note: if reserve is multisig, then user will use executeSignedTxnFromFile function
  await issue(deployer, bob.addr, 200); // issue(mint) 100 tokens to bob from reserve

  // transaction PASS: both bob & john are whitelisted & receiver balance <= 100
  await forceTransfer(deployer, bob.addr, john.addr, 15);

  try {
    // transaction FAIL: as receiver will have balance > 100 now
    await forceTransfer(deployer, bob.addr, john.addr, 90);
  } catch (e) {
    console.log('[Expected (receiver asset_balance > 100)]', e.response ? e.response.error.text : e);
  }

  try {
    // transaction FAIL: amount is good but elon is not whitelisted
    await forceTransfer(deployer, bob.addr, elon.addr, 10);
  } catch (e) {
    console.log('[Expected (elon-musk is not whitelisted)]', e.response ? e.response.error.text : e);
  }
}

module.exports = { default: run, forceTransfer: forceTransfer };
