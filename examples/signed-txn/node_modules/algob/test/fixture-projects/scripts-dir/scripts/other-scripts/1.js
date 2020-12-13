
const fs = require('fs')

async function run (runtimeEnv, deployer) {
  fs.appendFileSync('output.txt', 'other scripts directory: script 1 executed\n')
}

module.exports = { default: run }
