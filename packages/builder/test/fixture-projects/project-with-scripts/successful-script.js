
const fs = require("fs");

export default async function (runtimeEnv, deployer, accounts) {
  if (runtimeEnv.config === undefined || runtimeEnv.network === undefined) {
    throw new Error("Config was not provided");
  }
  fs.appendFileSync("output.txt", runtimeEnv.network.name);
}
