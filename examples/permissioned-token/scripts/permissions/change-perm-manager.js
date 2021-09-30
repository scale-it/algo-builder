const { fundAccount, executeTransaction, optInAccountToApp } = require('../common/common');
const { whitelist } = require('./whitelist');
const { types } = require('@algo-builder/web');
const accounts = require('../common/accounts');

/**
 * Only current perm_manager can update permissions_manager to a new address.
 * @param deployer algobDeployer
 * @param address account address to change permissions_manager to
 */
async function changePermissionsManager (deployer, permissionsManager, address) {
  const permissionSSCInfo = deployer.getApp('permissions.py', 'clear_state_program.py');

  const changePerManagerParams = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: permissionsManager, // asset manager account (fails otherwise)
    appID: permissionSSCInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:change_permissions_manager'],
    accounts: [address]
  };

  console.log(`\n* Updating permissions manager to: ${address} *`);
  await executeTransaction(deployer, changePerManagerParams);
}

async function run (runtimeEnv, deployer) {
  // by default ASA owner is the permission manager
  const permissionsManager = deployer.accountsByName.get(accounts.owner);
  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  // fund accounts
  await fundAccount(deployer, [permissionsManager, elon]);

  console.log('* Opt-In to permissions(rules) smart contract *');
  const permissionSSCInfo = deployer.getApp('permissions.py', 'clear_state_program.py');
  await optInAccountToApp(deployer, elon, permissionSSCInfo.appID, {}, {});

  // tx FAIL because john is not a permissions manager
  try {
    await whitelist(deployer, john, elon.addr); // fails
  } catch (e) {
    console.log('[Expected error (john !== permissions_manager)]:', e.response?.error.text);
  }

  await changePermissionsManager(deployer, permissionsManager, john.addr);

  // tx PASS: as we updated permissions manager to john
  await whitelist(deployer, john, elon.addr);
}

module.exports = { default: run, changePermissionsManager: changePermissionsManager };
