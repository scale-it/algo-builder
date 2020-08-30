
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASC('fee-check.teal', {}, { creator: deployer.accounts[0], microAlgo: 100000000 })
  }
}

module.exports = { default: run }
