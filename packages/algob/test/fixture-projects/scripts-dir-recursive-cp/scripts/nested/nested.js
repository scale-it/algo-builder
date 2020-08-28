
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASA('ASA from nested', {}, deployer.accounts['acc-name-1'])
  }
}

module.exports = { default: run }
