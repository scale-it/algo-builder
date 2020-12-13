
const fs = require('fs')

async function run (runtimeEnv, deployer) {
  if (deployer.isDeployMode) {
    deployer.putMetadata('META from first', 'first-ok')
  }
  fs.appendFileSync(
    'output.txt',
    'script1: META from first defined: ' + deployer.getMetadata('META from first') + '\n')
  fs.appendFileSync(
    'output.txt',
    'script1: META from second defined: ' + deployer.getMetadata('META from second') + '\n')
  fs.appendFileSync(
    'output.txt',
    'script1: META from third defined: ' + deployer.getMetadata('META from third') + '\n')
}

module.exports = { default: run }
