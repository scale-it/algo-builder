
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    await deployer.deployASA('ASA from first', {}, deployer.accounts[0])
  }
}

module.exports = { default: run }
