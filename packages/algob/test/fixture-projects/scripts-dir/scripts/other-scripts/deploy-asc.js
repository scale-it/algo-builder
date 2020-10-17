
const fs = require('fs')

async function run (runtimeEnv, deployer) {
  fs.appendFileSync('output.txt', 'fundLsig script\n')
  await deployer.fundLsig('metadata key', {}, 'metadata value')
  fs.appendFileSync('output.txt', 'fundLsig script after\n')
}

module.exports = { default: run }
