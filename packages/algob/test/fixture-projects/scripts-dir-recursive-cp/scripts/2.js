
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASC('ASC from second', {}, deployer.accounts[0])
  }
}

module.exports = { default: run }
