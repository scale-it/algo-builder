
const fs = require("fs");

export default async function (runtimeEnv, deployer, accounts) {
  fs.appendFileSync("output.txt", runtimeEnv.network.name);
}
