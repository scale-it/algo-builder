const { transferMicroAlgos, transferAsset, balanceOf } = require("algob");

async function run(runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account");

  await transferMicroAlgos(deployer, masterAccount, johnAccount.addr, 1000000, {note: "ALGO PAID"})
}

module.exports = { default: run }
