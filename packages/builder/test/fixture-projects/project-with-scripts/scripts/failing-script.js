const fs = require('fs')

async function run (runtimeEnv, accounts, deployer) {
  fs.appendFileSync('output.txt', 'failing script: before exception')
  throw new Error('Error originating from script')
}

module.exports = { default: run }
