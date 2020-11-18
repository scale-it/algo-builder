const { executeTransaction, balanceOf } = require("algob");
const { mkParam } = require("./common");

async function run(runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account");

  await executeTransaction(deployer, mkParam(masterAccount, johnAccount.addr, 1000000, {note: "ALGO PAID"}))
}

module.exports = { default: run }
