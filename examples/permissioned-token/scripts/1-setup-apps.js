const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

const clearStateProgram = 'clear_state_program.py';
/**
 * Deploy Controller Smart Contract (only asa manager can do that)
 * This initializes the rules counter to 0. After this we can add rules.
 */
async function setupControllerSSC (asaInfo, deployer) {
  const alice = deployer.accountsByName.get('alice');

  const appArgs = [
    `int:${asaInfo.assetIndex}` // pass token_id to controller
  ];

  console.log('** Deploying smart contract: controller **');
  const controllerSSCInfo = await deployer.deploySSC(
    'controller.py', // approval program
    clearStateProgram, // clear program
    {
      sender: alice,
      localInts: 0,
      localBytes: 1, // to store permissions manager in local state
      globalInts: 4, // 1 to store max_tokens, 1 for storing total whitelisted accounts
      globalBytes: 2, // 1 to store whitelisted status in local state
      appArgs: appArgs,
      foreignAssets: [asaInfo.assetIndex] // pass token_id in foreign assets array
    }, {});
  console.log(controllerSSCInfo);
}

/**
 * - Deploy Permissions(rules) smart contract
 * - After deploying rules contract, add it to controller (using add_permission argument)
 */
async function setupPermissionsSSC (asaInfo, controllerSSCInfo, deployer) {
  const alice = deployer.accountsByName.get('alice');

  /** Deploy Permissions(rules) smart contract **/
  console.log('** Deploying smart contract: permissions **');
  const permissionSSCInfo = await deployer.deploySSC(
    'permissions.py', // approval program
    clearStateProgram, // clear program
    {
      sender: alice,
      localInts: 1, // 1 to store whitelisted status in local state
      localBytes: 0,
      globalInts: 3, // 1 to store max_tokens, 1 for storing total whitelisted accounts
      globalBytes: 1,
      appArgs: [`int:${controllerSSCInfo.appID}`]
    }, {});
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
    const controllerAppId = controllerSSCInfo.appID;
    await executeTransaction(deployer, {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice, // asa manager account
      appId: controllerAppId,
      payFlags: { totalFee: 1000 },
      appArgs: appArgs,
      foreignAssets: [asaInfo.assetIndex] // controller sc verifies if correct token is being used + asa.manager is correct one
    });
  } catch (e) {
    console.log('Error occurred', e.response.error);
  }
}

async function run (runtimeEnv, deployer) {
  /**
   * - just for tutorial purpose. Below functions deploys permissions and controller smart contracts
   * from a single account: alice (which is the ASA manager). After deploying the two, we add permissioned
   * asc in controller smart contract.
   * - If asa manager is a multisig account (eg. [alice, john]), then user will receive a signed txn
   * file, and then we can use `executeSignedTxnFromFile` to execute the txn
   */
  const asaInfo = deployer.asa.get('gold');
  await setupControllerSSC(asaInfo, deployer);

  const controllerSSCInfo = deployer.getSSC('controller.py', clearStateProgram);
  await setupPermissionsSSC(asaInfo, controllerSSCInfo, deployer);

  /* Use below function to deploy SSC's if you receive a txn file from a shared network */
  // executeSignedTxnFromFile(deployer, 'ssc_file_out.tx');
}

module.exports = { default: run };
