
const fs = require('fs')

async function run (runtimeEnv, deployer) {
  fs.appendFileSync(
    'output.txt',
    'ASA from first defined: ' + deployer.isDefined('ASA from first') + '\n'
  )
  fs.appendFileSync(
    'output.txt',
    'Lsig from second defined: ' + deployer.isDefined('fee-check.teal'))
}

module.exports = { default: run }
