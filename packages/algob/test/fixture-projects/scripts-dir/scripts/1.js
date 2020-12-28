
const fs = require('fs')

async function run (runtimeEnv, deployer) {
  fs.appendFileSync('output.txt', 'scripts directory: script 1 executed\n')
  if (deployer.isDeployMode) {
    deployer.addCheckpointKV('script 1 key', 'script 1 value')
  }
}

module.exports = { default: run }
