
const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  fs.appendFileSync('output.txt', 'deployASA script\n')
  await deployer.deployASA('metadata key', 'metadata value')
  fs.appendFileSync('output.txt', 'deployASA script after\n')
}

module.exports = { default: run }
