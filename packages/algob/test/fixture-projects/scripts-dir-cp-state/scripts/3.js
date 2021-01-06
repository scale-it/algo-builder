const fs = require('fs')

async function run (runtimeEnv, deployer) {
  if (deployer.isDeployMode) {
    deployer.addCheckpointKV('META from third', 'third-ok')
  }
  fs.appendFileSync(
    'output.txt',
    'script3: META from first defined: ' + deployer.getCheckpointKV('META from first') + '\n')
  fs.appendFileSync(
    'output.txt',
    'script3: META from second defined: ' + deployer.getCheckpointKV('META from second') + '\n')
  fs.appendFileSync(
    'output.txt',
    'script3: META from third defined: ' + deployer.getCheckpointKV('META from third') + '\n')
}

module.exports = { default: run }
