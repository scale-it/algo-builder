
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASC('ASC from second', {}, deployer.accountsByName.get('acc-name-1'))
  }
}

module.exports = { default: run }
