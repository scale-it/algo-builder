
const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  fs.appendFileSync('output.txt', 'put metadata script\n')
  deployer.putMetadata('metadata key', 'metadata value')
  fs.appendFileSync('output.txt', 'put metadata script after')
}

module.exports = { default: run }
