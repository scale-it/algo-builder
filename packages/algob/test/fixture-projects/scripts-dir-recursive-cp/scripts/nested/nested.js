
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    await deployer.deployASA('ASA from nested', 'ASA nested src', 'ASA@nested_key')
  }
}

module.exports = { default: run }
