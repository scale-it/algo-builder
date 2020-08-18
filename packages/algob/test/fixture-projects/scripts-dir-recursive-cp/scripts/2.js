
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    await deployer.deployASC('ASC from second', {}, deployer.accounts[0])
  }
}

module.exports = { default: run }
