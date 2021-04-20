const {
  balanceOf, executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { issue } = require('../issuance/issue');
const { whitelist } = require('../permissions/whitelist');

const { fundAccount } = require('../common/common');
const clearStateProgram = 'clear_state_program.py';

/**
 * Transfer token between non-reserve accounts
 * @param from fromAccount
 * @param to toAccount
 * @param {number} amount units of token to transfer
 */
async function transfer (deployer, from, to, amount) {
  /**
   * Opt-In to asa by "to" account first (skip if opted-in already)
   */
  console.log(`* Opt-In ASA gold for ${to.name} *`);
  try { await deployer.optInAcountToASA('gold', to.name, {}); } catch (e) { console.log(e); throw new Error(e); }
  console.log('* Opt-In Successful *');

  const asaInfo = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', clearStateProgram);
  const permissionsSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);

  const escrowParams = {
    TOKEN_ID: asaInfo.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback-escrow.py', [], escrowParams);
  const escrowAddress = escrowLsig.address();

  const txGroup = [
    /**
     * tx 0 - Call to controller stateful smart contract with application arg: 'transfer'
     * The contract ensures that there is a call to permissions smart contract in the txGroup,
     * so that rules are checked during token transfer. The smart contract also checks each transaction
     * params in the txGroup (eg. sender(tx1) === receiver(tx2) === escrowAddress)
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: from,
      appId: controllerSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:transfer']
      // accounts: [bob.addr] //  AppAccounts
    },
    /**
     * tx 1 - Asset transfer transaction from sender -> receiver. This tx is executed
     * and approved by the escrow account (clawback-escrow.teal). The escrow account address is
     * also the clawback address which transfers the frozen asset (amount = 1000) from Alice to Bob.
     * Clawback-escrow ensures a call to controller smart contract during token transfer.
     */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccount: { addr: escrowAddress },
      recipient: to.addr,
      assetID: asaInfo.assetIndex,
      revocationTarget: from.addr,
      amount: amount,
      lsig: escrowLsig,
      payFlags: { totalFee: 1000 }
    },
    /**
     * tx 2 - Payment transaction of 1000 microAlgo from "from account" to escrow Account. This tx is used to
     * cover the fee of tx1 (clawback).
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
     * The contract ensures that alice and bob have a minimum level (accred-level) set
     * and only then the tx will be approved. The smart contract also checks each transaction
     * params in the txGroup (eg. sender(tx1) === receiver(tx2) === escrowAddress)
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: from,
      appId: permissionsSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:transfer'],
      accounts: [to.addr] //  AppAccounts
    }
  ];

  console.log(`* Transferring ${amount} tokens from
    [${from.name}:${from.addr}] to [${to.name}:${to.addr}] *`);
  await executeTransaction(deployer, txGroup);

  console.log(`* ${to.name} asset holding: *`);
  await balanceOf(deployer, to.addr, asaInfo.assetIndex);

  console.log('* Transfer Successful *');
}

async function run (runtimeEnv, deployer) {
  // alice is set-up as the permissions manager during deploy
  const permissionsManager = deployer.accountsByName.get('alice');
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

  /**
   * use below function to whitelist accounts (which opts in these accounts to permissions_ssc as well)
   * check ../permissions/whitelist.js to see whitelisting accounts
   * comment below code if [from, to] accounts are already whitelisted
   * NOTE: whitelist() transaction will be executed by the permissionsManager,
   * current_user (a non reserve account) will not control permissionsManager account.
   */
  await whitelist(deployer, permissionsManager, bob);
  await whitelist(deployer, permissionsManager, john);

  // note: if reserve is multisig, then user will use executeSignedTxnFromFile function
  await issue(deployer, bob, 300); // issue(mint) 300 tokens to bob from reserve

  // transaction PASS: both bob & john are whitelisted & receiver balance <= 100
  await transfer(deployer, bob, john, 30);

  try {
    // transaction FAIL: as receiver will have balance of 110 now(> 100)
    await transfer(deployer, bob, john, 80);
  } catch (e) {
    console.log('[Expected (receiver asset_balance > 100)]', e.response ? e.response.error.text : e);
  }

  try {
    // opt-in elon to permissions first
    const permissionsSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);
    await deployer.optInToSSC(elon, permissionsSSCInfo.appID, {}, {});

    // transaction FAIL: amount is good but elon is not whitelisted
    await transfer(deployer, bob, elon, 10);
  } catch (e) {
    console.log('[Expected (elon-musk is not whitelisted)]', e.response ? e.response.error.text : e);
  }
}

module.exports = { default: run };
