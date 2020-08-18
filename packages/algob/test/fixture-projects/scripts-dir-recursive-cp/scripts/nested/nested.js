
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    await deployer.deployASA('ASA from nested', {}, deployer.accounts[0])
  }
}

module.exports = { default: run }
