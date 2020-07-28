
const fs = require("fs");

async function run(runtimeEnv, accounts, deployer) {
  if (runtimeEnv.config === undefined || runtimeEnv.network === undefined) {
    throw new Error("Config was not provided");
  }
  fs.appendFileSync("output.txt", runtimeEnv.network.name);
}

module.exports = { default: run }
