const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const accounts = require('./common/accounts');

/**
 * Deploy Permissions smart contract
 * and link it to the controller (using the controller  add_permission argument)
 */
async function setupPermissionsApp (runtimeEnv, deployer) {
  const controllerAppInfo = deployer.getApp('controller.py', 'clear_state_program.py');

  const tesla = deployer.asa.get('tesla');
  const owner = deployer.accountsByName.get(accounts.owner);
  const controllerappID = controllerAppInfo.appID;

  const templateParam = {
    PERM_MANAGER: owner.addr // setting permission manager to the owner account
  };

  /** Deploy Permissions(rules) smart contract **/
  console.log('\n** Deploying smart contract: permissions **');
  const permissionSSCInfo = await deployer.deployApp(
    'permissions.py', // approval program
    'clear_state_program.py', // clear program
    {
      sender: owner,
      localInts: 1, // 1 to store whitelisted status in local state
      localBytes: 0,
      globalInts: 2, // 1 to store max_tokens, 1 for storing total whitelisted accounts
      globalBytes: 1 // to store permissions manager
    }, {}, templateParam); // pass perm_manager as a template param (to set during deploy)
  console.log(permissionSSCInfo);

  /**
   * After deploying rules, we need to add it's config (app_id & manager) to controller,
   * to ensure these rules are followed during transfer of the token
   * Notes:
   * + Only ASA owner can set a permissions contract (this is enforced by the controller smart
       contract code).
   * + We can update controller settings (eg changing the permissions contract) in RUN mode
   *   as well.
   * + Currently only 1 permissions app is supported.
   */
  console.log('\n** Linking permissions smart contract to the controller **');
  try {
    const appArgs = [
      'str:set_permission',
      `int:${permissionSSCInfo.appID}`
    ];

    await executeTransaction(deployer, {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: owner, // asa manager account
      appID: controllerappID,
      payFlags: { totalFee: 1000 },
      appArgs: appArgs,
      foreignAssets: [tesla.assetIndex] // controller sc verifies if correct token is being used + asa.manager is correct one
    });
  } catch (e) {
    console.log('Error occurred', e.response.error);
  }
}

module.exports = { default: setupPermissionsApp };
