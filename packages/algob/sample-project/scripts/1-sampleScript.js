async function run (runtimeEnv, deployer) {
  console.log('Sample script for ASC has started execution!');
  await deployer.fundLsig('fee-check.teal',
    { funder: deployer.accounts[0], fundingMicroAlgo: 20000000 }, {});

  await deployer.addCheckpointKV('User Checkpoint', 'Fund Contract Account');
  console.log('Sample script for ASC Funding execution has finished!');
}

module.exports = { default: run };
