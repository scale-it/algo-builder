
const fs = require('fs')

async function run (runtimeEnv, deployer) {
  fs.appendFileSync('output.txt', 'put metadata script\n')
  deployer.addCheckpointKV('metadata key', 'metadata value')
  fs.appendFileSync('output.txt', 'put metadata script after')
}

module.exports = { default: run }
