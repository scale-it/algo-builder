async function run (runtimeEnv, deployer) {
  const creatorAccount = deployer.accountsByName.get('alice');

  // Retreive AppInfo from checkpoints.
  const appInfo = deployer.getApp('CounterApp');
  const applicationID = appInfo.appID;
  console.log('Application Id ', applicationID);

  const updatedRes = await deployer.updateApp(
    creatorAccount,
    {}, // pay flags
    applicationID,
    'new_approval.teal',
    'new_clear.teal',
    {}
  );
  console.log('Application Updated: ', updatedRes);
}

module.exports = { default: run };
