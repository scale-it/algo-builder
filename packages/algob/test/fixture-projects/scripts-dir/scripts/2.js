const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  await new Promise(resolve => setTimeout(resolve, 100))
  fs.appendFileSync('output.txt', 'scripts directory: script 2 executed\n')
  if (deployer.isDeployMode) {
    deployer.putMetadata('script 2 key', 'script 2 value')
  }
}

module.exports = { default: run }
