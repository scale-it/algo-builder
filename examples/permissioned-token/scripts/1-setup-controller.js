/**
 * Deploy Controller Smart Contract (only asa manager can do that)
 */
async function setupControllerSSC (asaInfo, deployer) {
  const alice = deployer.accountsByName.get('alice');
  const gold = deployer.asa.get('gold');

  const templateParam = {
    TOKEN_ID: gold.assetIndex
  };

  console.log('** Deploying smart contract: controller **');
  const controllerSSCInfo = await deployer.deploySSC(
    'controller.py', // approval program
    'clear_state_program.py', // clear program
    {
      sender: alice,
      localInts: 0,
      localBytes: 0,
      globalInts: 2, // 1 to store kill_status, 1 for storing permissions_app_id
      globalBytes: 0,
      foreignAssets: [gold.assetIndex] // pass token_id in foreign assets array
    }, {}, templateParam); // pass token_id as a template paramenter
  console.log(controllerSSCInfo);
}

async function run (runtimeEnv, deployer) {
  /**
   * - just for tutorial purpose. Below functions deploys permissions and controller smart contracts
   * from a single account: alice (which is the ASA manager). After deploying the two, we add permissioned
   * asc in controller smart contract.
   * - If asa manager is a multisig account (eg. [alice, john]), then user will receive a signed txn
   * file, and then we can use `executeSignedTxnFromFile` to execute the txn
   */
  const gold = deployer.asa.get('gold');
  await setupControllerSSC(gold, deployer);

  /* Use below function to deploy SSC's if you receive a txn file from a shared network */
  // executeSignedTxnFromFile(deployer, 'ssc_file_out.tx');
}

module.exports = { default: run };
