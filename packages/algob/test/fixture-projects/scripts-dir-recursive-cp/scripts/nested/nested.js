
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASA('ASA from nested', {}, deployer.accountsByName.get('acc-name-1'))
  }
}

module.exports = { default: run }
