const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  if (deployer.isWriteable) {
    deployer.putMetadata('META from third', 'third-ok')
  }
  fs.appendFileSync(
    'output.txt',
    'script3: META from first defined: ' + deployer.getMetadata('META from first') + '\n')
  fs.appendFileSync(
    'output.txt',
    'script3: META from second defined: ' + deployer.getMetadata('META from second') + '\n')
  fs.appendFileSync(
    'output.txt',
    'script3: META from third defined: ' + deployer.getMetadata('META from third') + '\n')
}

module.exports = { default: run }
