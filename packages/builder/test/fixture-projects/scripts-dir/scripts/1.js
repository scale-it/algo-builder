
const fs = require('fs')

export default async function (runtimeEnv, deployer, accounts) {
  fs.appendFileSync("output.txt", "scripts directory: script 1 executed\n");
}
