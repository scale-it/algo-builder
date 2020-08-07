
async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    await deployer.deployASA('ASA from first', 'ASA first src', 'ASA@first_key')
  }
}

module.exports = { default: run }
