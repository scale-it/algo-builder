
const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    deployer.deployASA('ASA from first', 'ASA first src', 'ASA@first_key')
  }
}

module.exports = { default: run }
