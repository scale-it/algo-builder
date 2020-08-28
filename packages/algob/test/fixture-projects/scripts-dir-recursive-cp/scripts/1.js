
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASA('ASA from first', { creator: deployer.accounts[0] })
  }
}

module.exports = { default: run }
