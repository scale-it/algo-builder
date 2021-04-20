const {
  executeTransaction
} = require('@algo-builder/algob');
const { fundAccount } = require('../common/common');
const { types } = require('@algo-builder/runtime');

/**
 * If permissions manager is a multisig address, then user should have a signed tx file, decoded tx fetched
 * from that file, append his own signature & send it to network.
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from file (if using multisig account)
 *  - In below function we assume creator is a single account (alice)
 * @param deployer algobDeployer
 * @param manager permissions manager account: p_m is stored in controller smart contract. Tx is rejected if
 * manager account address is not correct
 * @param account account to whitelist
 */
async function whitelist (deployer, manager, account) {
  // asset, controller & permission app info
  const asaInfo = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');
  const permissionSSCInfo = deployer.getSSC('permissions.py', 'clear_state_program.py');

  console.log(`* Opt-In ${account.name} to permissions(rules) smart contract *`);
  try {
    await deployer.optInToSSC(account, permissionSSCInfo.appID, {}, {});
  } catch (e) {
    console.warn(e.response ? e.response.error?.text : e); // probably app already opted-in
    // throw new Error(e);
  }
  console.log('Opt-In successful.');

  /**
   * - Only permissions manager can add accounts to whitelist. Which is set to alice(during deploy).
   * - If incorrect token index is passed in foreignAssets then tx is rejected
   * - If address is already whitelisted then tx is accepted (with no change)
   * - controller app id must be passed in foreignapps, as permissions smart contract reads controller's
   *   global state to get & verify if permissions_manager is the sender or not
   * - Pass the address you wish to whitelist in Txn.accounts[1] to add to whitelist
   */
  const whiteListParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: manager, // permissions manager account (fails otherwise)
    appId: permissionSSCInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:add_whitelist', `int:${controllerSSCInfo.appID}`], // note: don't need to pass appID in appArg with tealv3 (just use foreignApps)
    accounts: [account.addr], // pass address to add to whitelists
    foreignAssets: [asaInfo.assetIndex], // to verify token_id
    foreignApps: [controllerSSCInfo.appID]
  };
  console.log(`* Adding [${account.name}:${account.addr}] to whitelisted accounts *`);
  await executeTransaction(deployer, whiteListParams);
}

async function run (runtimeEnv, deployer) {
  const alice = deployer.accountsByName.get('alice'); // alice is set as the permissions_manager during deploy
  const elon = deployer.accountsByName.get('elon-musk');
  const john = deployer.accountsByName.get('john');

  /** Fund permissions manager & accounts_to_whitelist by master **/
  await Promise.all([
    fundAccount(deployer, alice),
    fundAccount(deployer, elon),
    fundAccount(deployer, john)
  ]);

  /**
   * Add elon address to a list of whitelisted account addresses
   * + Fund accounts (manager, account_to_whitelist)
   * + Opt-In to permissions by elon (skip this code if already opted-in)
   * + call permissions smart contract with `add_whitelist` arg
   */
  await whitelist(deployer, alice, elon);

  // Transaction FAIL: sender !== permissions manager
  try {
    await whitelist(deployer, john, elon); // fails as john is not the permissions manager
  } catch (e) {
    console.log('[Expected (sender !== permissions manager)]', e.response?.error);
  }
}

module.exports = { default: run, whitelist: whitelist };
