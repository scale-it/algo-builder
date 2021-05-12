const { fundAccount, executeTransaction, optInAccountToSSC } = require('../common/common');
const { whitelist } = require('./whitelist');
const { types } = require('@algo-builder/runtime');

/**
 * If permissionsManager is a multisig address, then user should have a signed tx file, decoded tx fetched
 * from that file, append his own signature & send it to network.
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from file (if using multisig account)
 *  - In below function we assume permissionsManager is a single account (alice)
 * @param deployer algobDeployer
 * @param address account address to change permissions_manager to
 */
async function changePermissionsManager (deployer, permissionsManager, address) {
  const permissionSSCInfo = deployer.getSSC('permissions.py', 'clear_state_program.py');

  /**
   * Only current perm_manager can update permissions_manager to a new address.
   * Which is set to alice(during deploy).
   */
  const changePerManagerParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: permissionsManager, // asset manager account (fails otherwise)
    appId: permissionSSCInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:change_permissions_manager'],
    accounts: [address]
  };

  console.log(`* Updating permissions manager to: ${address} *`);
  await executeTransaction(deployer, changePerManagerParams);
}

async function run (runtimeEnv, deployer) {
  const permissionsManager = deployer.accountsByName.get('alice');
  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  // fund accounts
  await Promise.all([
    fundAccount(deployer, permissionsManager),
    fundAccount(deployer, elon)
  ]);

  console.log('* Opt-In to permissions(rules) smart contract *');
  const permissionSSCInfo = deployer.getSSC('permissions.py', 'clear_state_program.py');
  await optInAccountToSSC(deployer, elon, permissionSSCInfo.appID, {}, {});

  // tx FAIL: as john is not the permissions manager
  try {
    await whitelist(deployer, john, elon.addr); // fails
  } catch (e) {
    console.log('[Expected (john !== permissions_manager)]', e.response?.error.text);
  }

  /**
   * Use below function to update permission manager address in controllerSSC
   * Only asset manager can change permission manager
   */
  await changePermissionsManager(deployer, permissionsManager, john.addr);

  // tx PASS: as we updated permissions manager to john
  await whitelist(deployer, john, elon.addr);
}

module.exports = { default: run, changePermissionsManager: changePermissionsManager };
