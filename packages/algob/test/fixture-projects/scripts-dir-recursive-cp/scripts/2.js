
async function run (runtimeEnv, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASC('fee-check.teal', {}, { funder: deployer.accounts[0], microAlgo: 100000000, mode: 'DELEGATED_APPROVAL' }, {})
  }
}

module.exports = { default: run }
