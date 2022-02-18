async function run (runtimeEnv, deployer) {
  console.log('Sample script for ASC has started execution!');
  await deployer.mkContractLsig('fee-check.teal', 'feeCheck');
  await deployer.fundLsig('feeCheck',
    { funder: deployer.accounts[0], fundingMicroAlgo: 20e6 }, {});

  await deployer.addCheckpointKV('User Checkpoint', 'Fund Contract Account');
  console.log('Sample script for ASC Funding execution has finished!');
}

module.exports = { default: run };
