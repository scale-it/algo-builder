const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

/**
 * Compile and set clawback logic sig (escrow) with template parameters:
 * - token_id : deployed asa index
 * - controller_app_id: controller SSC application index. This makes sure that
 *   rules smart contract is called in any token transfer b/w non-reserve accounts
 * - token_reserve: asa.reserve address (owner of all non-minted tokens). Clawback checks during
 *   Issuance tx that from account is the asset reserve
 */
async function run (runtimeEnv, deployer) {
  const alice = deployer.accountsByName.get('alice');

  // NOTE: make sure to deploy asset, controller ssc first
  const gold = deployer.asa.get('gold');
  const controllerInfo = deployer.getSSC('controller.py', 'clear_state_program.py');

  /*
    Use below code if token_reserve is multisig account
    const bob = deployer.accountsByName.get('bob');
    const charlie = deployer.accountsByName.get('charlie');
    const john = deployer.accountsByName.get('john');
    // you can replace these addresses with your custom addrs for multisig account.
    const addrs = [alice.addr, bob.addr, john.addr, charlie.addr];
    const [_, multsigaddr] = createMsigAddress(1, 2, addrs); // use multsigaddr in TOKEN_RESERVE
  */

  /** Compile and fund escrow **/
  const escrowParams = {
    TOKEN_ID: gold.assetIndex,
    CONTROLLER_APP_ID: controllerInfo.appID
  };

  await deployer.fundLsig('clawback.py',
    { funder: alice, fundingMicroAlgo: 5e6 }, {}, escrowParams); // sending 5 Algo

  const escrowLsig = await deployer.loadLogic('clawback.py', escrowParams);
  const escrowAddress = escrowLsig.address();

  /** Update clawback address to escrow **/
  console.log('* Updating asset clawback to escrow *');
  const assetConfigParams = {
    type: types.TransactionType.ModifyAsset,
    sign: types.SignType.SecretKey,
    fromAccount: alice,
    assetID: gold.assetIndex,
    fields: { clawback: escrowAddress },
    payFlags: { totalFee: 1000 }
  };
  await executeTransaction(deployer, assetConfigParams);
}

module.exports = { default: run };
