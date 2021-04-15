const { fundAccount, executeTransaction } = require('../common/common');
const { whitelist } = require('./whitelist');
const { types } = require('@algo-builder/runtime');

/**
 * If asset manager is a multisig address, then user should have a signed tx file, decoded tx fetched
 * from that file, append his own signature & send it to network.
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from file (if using multisig account)
 *  - In below function we assume token manager is a single account (alice)
 * @param deployer algobDeployer
 * @param address account address to change permissions_manager to
 */
async function changePermissionsManager (deployer, assetManager, address) {
  const asaInfo = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');

  /**
   * - Only asset manager can update permissions_manager. Which is set to alice(during deploy).
   */
  const changePerManagerParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: assetManager, // asset manager account (fails otherwise)
    appId: controllerSSCInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:change_permissions_manager'], // note: don't need to pass appID in appArg with tealv3 (just use foreignApps)
    accounts: [address], // pass address to add to whitelists
    foreignAssets: [asaInfo.assetIndex] // to verify token_id & token_manager
  };

  console.log(`* Updating permissions manager to: ${address} *`);
  await executeTransaction(deployer, changePerManagerParams);
}

async function run (runtimeEnv, deployer) {
  const assetManager = deployer.accountsByName.get('alice');
  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  await fundAccount(deployer, assetManager); // fund asa.manager

  // tx FAIL: as john is not the permissions manager
  try {
    await whitelist(deployer, john, elon); // fails
  } catch (e) {
    console.log('[Expected (john !== permissions_manager)]', e.response?.error.text);
  }

  /**
   * Use below function to update permission manager address in controller
   * Only asset manager can do that
   */
  await changePermissionsManager(deployer, assetManager, john.addr);

  // tx PASS: as we updated permissions manager to john
  await whitelist(deployer, john, elon);
}

module.exports = { default: run, changePermissionsManager: changePermissionsManager };
