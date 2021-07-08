const accounts = require('./common/accounts');
const { fundAccount } = require('./common/common');

/**
 * Deploy a second Permissions smart contract.
 * note: this is an empty contract, to demonstrate how to replace/set a new app
 * using `/scripts/permissions/set-permissions-appid.js`
 */
async function setupNewPermissionsApp (runtimeEnv, deployer) {
  const owner = deployer.accountsByName.get(accounts.owner);
  await fundAccount(deployer, owner);

  // deploy new permissions smart contract
  const newPermissionsAppInfo = await deployer.deployApp(
    'permissions_new.teal', // new permissions contract
    'clear_state_program.py',
    {
      sender: owner,
      localInts: 0,
      localBytes: 0,
      globalInts: 0,
      globalBytes: 0
    }, {});
  console.log(newPermissionsAppInfo);
}

module.exports = { default: setupNewPermissionsApp };
