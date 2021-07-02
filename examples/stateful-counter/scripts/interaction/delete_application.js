const { executeTransaction } = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

async function run (runtimeEnv, deployer) {
  const creatorAccount = deployer.accountsByName.get('alice');

  // Retreive AppInfo from checkpoints.
  const appInfo = deployer.getApp('approval_program.teal', 'clear_program.teal');
  const applicationID = appInfo.appID;
  console.log('Application Id ', applicationID);

  const tx = {
    type: types.TransactionType.DeleteApp,
    sign: types.SignType.SecretKey,
    fromAccount: creatorAccount,
    appID: applicationID,
    payFlags: {},
    appArgs: []
  };

  await executeTransaction(deployer, tx);
  console.log('Application Deleted!!');
}

module.exports = { default: run };
