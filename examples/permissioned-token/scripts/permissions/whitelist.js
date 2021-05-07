const {
  executeTransaction
} = require('@algo-builder/algob');
const { fundAccount, optInToSSC } = require('../common/common');
const { types } = require('@algo-builder/runtime');

const clearStateProgram = 'clear_state_program.py';
/**
 * If permissions manager is a multisig address, then user should have a signed tx file, decoded tx fetched
 * from that file, append his own signature & send it to network.
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from file (if using multisig account)
 *  - In below function we assume creator is a single account (alice)
 * @param deployer algobDeployer
 * @param manager permissions manager account: p_m is stored in controller smart contract. Tx is rejected if
 * manager account address is not correct
 * @param address account address to whitelist
 */
async function whitelist (deployer, permissionsManager, address) {
  // permission app info
  const permissionSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);

  /**
   * - Only permissions manager can add accounts to whitelist. Which is set to alice(during deploy).
   * - If address is already whitelisted then tx is accepted (with no change)
   * - Pass the address you wish to whitelist in Txn.accounts[1] to add to whitelist
   */
  const whiteListParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: permissionsManager, // permissions manager account (fails otherwise)
    appId: permissionSSCInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:add_whitelist'],
    accounts: [address] // pass address to add to whitelisted addresses
  };
  console.log(`* Adding [${address}] to whitelisted accounts *`);
  await executeTransaction(deployer, whiteListParams);
}

async function run (runtimeEnv, deployer) {
  const alice = deployer.accountsByName.get('alice'); // alice is set as the permissions_manager during deploy
  const elon = deployer.accountsByName.get('elon-musk');
  const john = deployer.accountsByName.get('john');
  const permissionSSCInfo = deployer.getSSC('permissions.py', clearStateProgram);

  /** Fund permissions manager & accounts_to_whitelist by master **/
  await Promise.all([
    fundAccount(deployer, alice),
    fundAccount(deployer, elon),
    fundAccount(deployer, john)
  ]);

  console.log('* Opt-In to permissions(rules) smart contract *');
  await optInToSSC(deployer, elon, permissionSSCInfo.appID, {}, {});

  /**
   * Add elon address to a list of whitelisted account addresses
   * + Fund accounts (manager, account_to_whitelist)
   * + Opt-In to permissions by elon (skip this code if already opted-in)
   * + call permissions smart contract with `add_whitelist` arg
   */
  await whitelist(deployer, alice, elon.addr);

  // Transaction FAIL: sender !== permissions manager
  try {
    await whitelist(deployer, john, elon.addr); // fails as john is not the permissions manager
  } catch (e) {
    console.log('[Expected (sender !== permissions manager)]', e.response?.error);
  }
}

module.exports = { default: run, whitelist: whitelist };
