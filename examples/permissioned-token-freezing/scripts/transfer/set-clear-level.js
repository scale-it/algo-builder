const { executeTransaction } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const creator = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  /**
   * Set level:2 for Alice and Bob (required by smart-contract for asset transfer)
   * level refers to the minimum required level of user to transfer an asset
   */
  const appInfo = deployer.getSSC('poi-approval.teal', 'poi-clear.teal');
  const setLevelParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: creator,
    appId: appInfo.appID,
    payFlags: {},
    appArgs: ['str:set-level', 'int:2'],
    accounts: [creator.addr] //  AppAccounts
  };

  console.log('* Setting level 2 for Alice and Bob *');
  await executeTransaction(deployer, setLevelParams);
  await executeTransaction(deployer, {
    ...setLevelParams,
    accounts: [bob.addr]
  });

  /* Use below code to clear the min asset level set
    const clearLevelParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: creator,
      appId: appInfo.appID,
      payFlags: {},
      appArgs: [ "str:clear" ]
    };
    await executeTransaction(deployer, clearLevelParams);
  */
}

module.exports = { default: run };
