
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASA('ASA from first', { creator: deployer.accounts['acc-name-1'] })
  }
}

module.exports = { default: run }
