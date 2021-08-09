const accounts = require('./common/accounts');

/**
 * Deploy Controller Smart Contract (only ASA manager can do that)
 *
 * For tutorial purpose. We deploy permissions smart contract using a single
 * account: owner (which is the ASA manager).
 *
 * NOTE: If asa manager is a multisig account (eg. [alice, john]), then you should use
 * transaction exported to a file, signed by required signers and use
 * `executeSignedTxnFromFile` to execute the transaction.
 */
async function setupControllerSSC (runtimeEnv, deployer) {
  const tesla = deployer.asa.get('tesla');
  const owner = deployer.accountsByName.get(accounts.owner);

  const templateParam = {
    TOKEN_ID: tesla.assetIndex
  };

  console.log('\n** Deploying smart contract: controller **');
  const controllerAppInfo = await deployer.deployApp(
    'controller.py', // approval program
    'clear_state_program.py', // clear program
    {
      sender: owner,
      localInts: 0,
      localBytes: 0,
      globalInts: 2, // 1 to store kill_status, 1 for storing permissions_app_id
      globalBytes: 0,
      foreignAssets: [tesla.assetIndex] // pass token_id in foreign assets array
    }, {}, templateParam); // pass token_id as a template paramenter
  console.log(controllerAppInfo);

  // Use executeSignedTxnFromFile function to execute deployment transaction from a signed file:
  // executeSignedTxnFromFile(deployer, 'ssc_file_out.tx');
}

module.exports = { default: setupControllerSSC };
