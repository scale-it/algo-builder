const { executeTransaction } = require('@algorand-builder/algob');
const { types } = require('@algorand-builder/runtime');

async function run (runtimeEnv, deployer) {
  const creator = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  /* Set level:2 for Alice and Bob (required by smart-contract for asset transfer)
   * level refers to the minimum required level of user to transfer an asset
   */
  const appInfo = deployer.getSSC('poi.teal', 'poi-clear.teal');
  const appCallParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: creator,
    appId: appInfo.appID,
    payFlags: {},
    appArgs: ['str:set-level', 'int:2'],
    accounts: [creator.addr] //  AppAccounts
  };

  await executeTransaction(deployer, appCallParams);
  await executeTransaction(deployer, {
    ...appCallParams,
    accounts: [bob.addr]
  });
}

module.exports = { default: run };
