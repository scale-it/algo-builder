
const fs = require('fs')

async function run (runtimeEnv, deployer) {
  fs.appendFileSync('output.txt', 'deployASC script\n')
  await deployer.deployASC('metadata key', {}, 'metadata value')
  fs.appendFileSync('output.txt', 'deployASC script after\n')
}

module.exports = { default: run }
