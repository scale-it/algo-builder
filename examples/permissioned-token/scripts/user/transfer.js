const {
  balanceOf, executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { issue } = require('../admin/issue');
const { whitelist } = require('../permissions/whitelist');

const { fundAccount, optInToSSC } = require('../common/common');
const clearStateProgram = 'clear_state_program.py';

/**
 * Transfer token between non-reserve accounts
 * @param from fromAccount
 * @param toAddr toAccountAddress
 * @param {number} amount units of token to transfer
 */
async function transfer (deployer, from, toAddr, amount) {
  const gold = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', clearStateProgram);
  const permissionsSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);

  const escrowParams = {
    TOKEN_ID: gold.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback.py', escrowParams);
  const escrowAddress = escrowLsig.address();

  const txGroup = [
    /**
     * tx 0 - Call to controller stateful smart contract with application arg: 'transfer'
     * The contract ensures that there is a call to permissions smart contract in the txGroup,
     * so that rules are checked during token transfer.
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: from,
      appId: controllerSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:transfer']
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
      revocationTarget: from.addr,
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
      fromAccount: from,
      toAccountAddr: escrowAddress,
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    },
    /**
     * tx 3 - Call to permissions stateful smart contract with application arg: 'transfer'
     * The contract ensures that both accA & accB is whitelisted and asset_receiver does not hold
     * more than 100 tokens.
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: from,
      appId: permissionsSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:transfer'],
      accounts: [from.addr, toAddr] //  AppAccounts (pass asset sender & receiver address)
    }
  ];

  console.log(`* Transferring ${amount} tokens from
    [${from.name}:${from.addr}] to [${toAddr}] *`);
  await executeTransaction(deployer, txGroup);

  console.log(`* ${toAddr}(receiver) asset holding: *`);
  await balanceOf(deployer, toAddr, gold.assetIndex);

  console.log('* Transfer Successful *');
}

async function run (runtimeEnv, deployer) {
  // alice is set-up as the permissions manager during deploy
  const permissionsManager = deployer.accountsByName.get('alice');
  const permissionsSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);

  /**
   * Transfer some tokens b/w 2 non-reserve accounts
   * - Account A - bob
   * - Account B - john
   * - First whitelist bob & john account
   * - Second, issue few tokens from ASA Reserve to bob
   * - Finally, do token transfer tx from [bob -> john]
   * Both bob & john are non reserve accounts
   */
  const bob = deployer.accountsByName.get('bob');
  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  /** Fund john, bob, permissionsManager accounts by master **/
  await Promise.all([
    fundAccount(deployer, permissionsManager),
    fundAccount(deployer, john),
    fundAccount(deployer, bob),
    fundAccount(deployer, elon)
  ]);

  // opt-in accounts to permissions smart contract
  // comment this code if already opted-in
  await optInToSSC(deployer, elon, permissionsSSCInfo.appID, {}, {});
  await optInToSSC(deployer, bob, permissionsSSCInfo.appID, {}, {});
  await optInToSSC(deployer, john, permissionsSSCInfo.appID, {}, {});

  /**
   * use below function to whitelist accounts
   * check ../permissions/whitelist.js to see whitelisting accounts
   * comment below code if [from, to] accounts are already whitelisted
   * NOTE: whitelist() transaction will be executed by the permissionsManager,
   * current_user (a non reserve account) will not control permissionsManager account.
   */
  await whitelist(deployer, permissionsManager, bob.addr);
  await whitelist(deployer, permissionsManager, john.addr);

  // opt-in accounts to asa 'gold' (so they can receive it)
  await Promise.all([
    deployer.optInAcountToASA('gold', elon.name, {}),
    deployer.optInAcountToASA('gold', bob.name, {}),
    deployer.optInAcountToASA('gold', john.name, {})
  ]);

  // note: if reserve is multisig, then user will use executeSignedTxnFromFile function
  await issue(deployer, bob.addr, 300); // issue(mint) 300 tokens to bob from reserve

  // transaction PASS: both bob & john are whitelisted & receiver balance <= 100)
  await transfer(deployer, bob, john.addr, 15);

  try {
    // transaction FAIL: as receiver will have balance of 105 now(> 100)
    await transfer(deployer, bob, john.addr, 90);
  } catch (e) {
    console.log('[Expected (receiver asset_balance > 100)]', e.response ? e.response.error.text : e);
  }

  try {
    // transaction FAIL: amount is good but elon is not whitelisted
    await transfer(deployer, bob, elon.addr, 10);
  } catch (e) {
    console.log('[Expected (elon-musk is not whitelisted)]', e.response ? e.response.error.text : e);
  }
}

module.exports = { default: run, transfer: transfer };
