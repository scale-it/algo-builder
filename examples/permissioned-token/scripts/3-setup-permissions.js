const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

/**
 * - Deploy Permissions(rules) smart contract
 * - After deploying rules contract, add it to controller (using add_permission argument)
 */
async function setupPermissionsSSC (controllerSSCInfo, deployer) {
  const gold = deployer.asa.get('gold');
  const alice = deployer.accountsByName.get('alice');
  const controllerAppId = controllerSSCInfo.appID;

  const templateParam = {
    CONTROLLER_APP_ID: controllerAppId
  };

  /** Deploy Permissions(rules) smart contract **/
  console.log('** Deploying smart contract: permissions **');
  const permissionSSCInfo = await deployer.deploySSC(
    'permissions.py', // approval program
    'clear_state_program.py', // clear program
    {
      sender: alice,
      localInts: 1, // 1 to store whitelisted status in local state
      localBytes: 0,
      globalInts: 2, // 1 to store max_tokens, 1 for storing total whitelisted accounts
      globalBytes: 0
    }, {}, templateParam); // pass controller_app_id as a template param
  console.log(permissionSSCInfo);

  /**
   * After deploying rules, we need to add it's config (app_id & manager) to controller,
   * to ensure these rules are followed during transfer of the token
   * Note:
   * + Only ASA can add a new rule contract
   * + Could be used in RUN mode as well (as adding rules could be dynamic)
   * + Currently only 1 rules smart contract is supported
   */
  console.log('** Adding permissions smart contract config(id, address) to controller **');
  try {
    const appArgs = [
      'str:add_permission',
      `int:${permissionSSCInfo.appID}`,
      // setting permission asc creator as the permissions manager by default(but asset manager can change it)
      `addr:${permissionSSCInfo.creator}`
    ];

    await executeTransaction(deployer, {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice, // asa manager account
      appId: controllerAppId,
      payFlags: { totalFee: 1000 },
      appArgs: appArgs,
      foreignAssets: [gold.assetIndex] // controller sc verifies if correct token is being used + asa.manager is correct one
    });
  } catch (e) {
    console.log('Error occurred', e.response.error);
  }
}

async function run (runtimeEnv, deployer) {
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');
  await setupPermissionsSSC(controllerSSCInfo, deployer);

  /* Use below function to deploy SSC's if you receive a txn file from a shared network */
  // executeSignedTxnFromFile(deployer, 'ssc_file_out.tx');
}

module.exports = { default: run };
