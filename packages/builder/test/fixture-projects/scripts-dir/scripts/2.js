const fs = require('fs')

export default async function (runtimeEnv, deployer, accounts) {
  await new Promise(resolve => setTimeout(resolve, 100));
  fs.appendFileSync("output.txt", "scripts directory: script 2 executed\n");
}
