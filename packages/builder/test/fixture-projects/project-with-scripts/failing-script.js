const fs = require("fs")

export default async function (runtimeEnv, deployer, accounts) {
  fs.appendFileSync("output.txt", "failing script: before exception");
  throw new Error("Error originating from script");
  fs.appendFileSync("output.txt", "failing script: after exception");
}
