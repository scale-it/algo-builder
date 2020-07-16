
const fs = require('fs')

export default async function (runtimeEnv, deployer, accounts) {
  fs.appendFileSync("output.txt", "failing script: script executed\n");
  return 123;
}
