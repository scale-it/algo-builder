async function run (runtimeEnv, deployer) {
  const creatorAccount = deployer.accountsByName.get('alice');

  // Retreive AppInfo from checkpoints.
  const appInfo = deployer.getSSC('approval_program.teal', 'clear_program.teal');
  const applicationID = appInfo.appID;
  console.log('Application Id ', applicationID);

  const updatedRes = await deployer.updateSSC(
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
