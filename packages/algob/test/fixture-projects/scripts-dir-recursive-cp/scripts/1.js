
async function run (runtimeEnv, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASA('ASA from first', { creator: deployer.accountsByName.get('acc-name-1') })
  }
}

module.exports = { default: run }
