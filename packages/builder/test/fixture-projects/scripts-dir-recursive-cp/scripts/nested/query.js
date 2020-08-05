
const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  fs.appendFileSync(
    'output.txt',
    'ASA from first defined: ' + deployer.isDefined('ASA from first') + '\n'
  )
  fs.appendFileSync(
    'output.txt',
    'ASC from second defined: ' + String(deployer.isDefined('ASC from second')))
}

module.exports = { default: run }
