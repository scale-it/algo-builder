const {
  balanceOf, executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { issue } = require('./issue');
const { whitelist } = require('../permissions/whitelist');

const { fundAccount, optInAccountToSSC } = require('../common/common');
const clearStateProgram = 'clear_state_program.py';

/**
 * Force transfer tokens between 2 accounts by (signed by token manager)
 * @param from fromAccountAddress
 * @param to toAccountAddress
 * @param {number} amount units of token to transfer
 */
async function forceTransfer (deployer, fromAddr, toAddr, amount) {
  const asaManager = deployer.accountsByName.get('alice'); // alice is set as the permissions_manager during deploy
  const gold = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', clearStateProgram);
  const permissionsSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);

  const escrowParams = {
    TOKEN_ID: gold.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback.py', escrowParams);
  const escrowAddress = escrowLsig.address();

  // notice the difference in calls here: stateful calls are done by token manager here
  // and from, to address are only used in asset transfer tx
  const forceTxGroup = [
    /**
     * tx 0 - Call to controller stateful smart contract (by ASA.manager)
     * with application arg: 'force_transfer'. The contract ensures that there
     * is a call to permissions smart contract in the txGroup, so that rules
     * are checked during token transfer.
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: asaManager,
      appId: controllerSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:force_transfer'],
      foreignAssets: [gold.assetIndex] // to verify token reserve, manager
    },
    /**
     * tx 1 - Asset transfer transaction from sender -> receiver. This tx is executed
     * and approved by the escrow account (clawback.teal). The escrow account address is
     * also the clawback address which transfers the frozen asset (amount = amount) from accA to accB.
     * Clawback ensures a call to controller smart contract during token transfer.
     */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: escrowAddress,
      recipient: toAddr,
      assetID: gold.assetIndex,
      revocationTarget: fromAddr,
      amount: amount,
      lsig: escrowLsig,
      payFlags: { totalFee: 1000 }
    },
    /**
     * tx 2 - Payment transaction of 1000 microAlgo. This tx is used to cover the fee of tx1 (clawback).
     * NOTE: It can be signed by any account, but it should be present in group.
     */
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: asaManager,
      toAccountAddr: escrowAddress,
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    },
    /**
     * tx 3 - Call to permissions stateful smart contract with application arg: 'transfer'
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: asaManager,
      appId: permissionsSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:transfer'],
      accounts: [fromAddr, toAddr] //  AppAccounts (pass asset sender & receiver address)
    }
  ];

  console.log(`* Transferring ${amount} tokens from
    [${fromAddr}] to [${toAddr}] *`);
  await executeTransaction(deployer, forceTxGroup);

  console.log(`* ${toAddr}(receiver) asset holding: *`);
  await balanceOf(deployer, toAddr, gold.assetIndex);

  console.log('* Transfer Successful *');
}

// similar to transfer.js, but tokens are transferred by the token manager in this case
async function run (runtimeEnv, deployer) {
  // alice is set-up as the manager(s) during deploy
  const asaManager = deployer.accountsByName.get('alice');
  const permissionsManager = deployer.accountsByName.get('alice');
  const permissionsSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);

  /**
   * Force transfer some tokens b/w 2 accounts
   */
  const bob = deployer.accountsByName.get('bob');
  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  /** Fund john, bob, permissionsManager accounts by master **/
  await Promise.all([
    fundAccount(deployer, asaManager),
    fundAccount(deployer, john),
    fundAccount(deployer, bob),
    fundAccount(deployer, elon)
  ]);

  // opt-in accounts to permissions smart contract
  // comment this code if already opted-in
  await optInAccountToSSC(deployer, elon, permissionsSSCInfo.appID, {}, {});
  await optInAccountToSSC(deployer, bob, permissionsSSCInfo.appID, {}, {});
  await optInAccountToSSC(deployer, john, permissionsSSCInfo.appID, {}, {});

  /**
   * use below function to whitelist accounts
   * check ../permissions/whitelist.js to see whitelisting accounts
   * comment below code if [from, to] accounts are already whitelisted
   * NOTE: whitelist() transaction will be executed by the permissionsManager,
   * current_user (a non reserve account) will not control permissionsManager account.
   */
  await whitelist(deployer, permissionsManager, bob.addr);
  await whitelist(deployer, permissionsManager, john.addr);

  // opt-in accounts to asa 'gold' (so they can receive the asset)
  await Promise.all([
    deployer.optInAcountToASA('gold', elon.name, {}),
    deployer.optInAcountToASA('gold', bob.name, {}),
    deployer.optInAcountToASA('gold', john.name, {})
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
