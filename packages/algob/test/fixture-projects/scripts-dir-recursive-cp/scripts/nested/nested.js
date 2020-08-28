
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASA('ASA from nested', {}, deployer.accounts[0])
  }
}

module.exports = { default: run }
