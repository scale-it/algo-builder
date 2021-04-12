const { readGlobalStateSSC, executeTransaction } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const creatorAccount = deployer.accountsByName.get('alice');

  // Retreive AppInfo from checkpoints.
  const appInfo = deployer.getSSC('approval_program.teal', 'clear_program.teal');
  const applicationID = appInfo.appID;
  console.log('Application Id ', applicationID);

  // Retreive Global State
  let globalState = await readGlobalStateSSC(deployer, creatorAccount.addr, applicationID);
  console.log(globalState);

  const tx = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: creatorAccount,
    appId: applicationID,
    payFlags: {}
  };

  await executeTransaction(deployer, tx);
  globalState = await readGlobalStateSSC(deployer, creatorAccount.addr, applicationID);
  console.log(globalState);
}

module.exports = { default: run };
