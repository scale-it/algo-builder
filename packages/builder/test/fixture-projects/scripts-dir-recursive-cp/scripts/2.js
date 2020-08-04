const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    deployer.deployASC('ASC from second', 'ASC from second src', "ASC@second_key")
  }
}

module.exports = { default: run }
