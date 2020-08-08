
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    await deployer.deployASC('ASC from second', 'ASC from second src', 'ASC@second_key')
  }
}

module.exports = { default: run }
