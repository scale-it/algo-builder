const { executeTransaction, balanceOf } = require("algob");
const { mkParam } = require("./transfer/common");

/*
  Create "tesla" Algorand Standard Asset (ASA)
  Accounts are loaded from config
  To use ASA accounts have to opt-in and owner is opt-in by default
  john-account is transferred some funds to execute opt-in transaction
*/
async function run(runtimeEnv, deployer) {
  console.log("[tesla]: Script has started execution!")

  const masterAccount = deployer.accountsByName.get("master-account")
  const elonMuskAccount = deployer.accountsByName.get("elon-musk-account");
  const johnAccount = deployer.accountsByName.get("john-account");

  // activate elonMusk account
  await executeTransaction(deployer, mkParam(masterAccount, elonMuskAccount.addr, 401000000, {note: "funding account"}))

  const asaInfo = await deployer.deployASA("tesla", {
    creator: elonMuskAccount})
  console.log(asaInfo)

  await deployer.optInToASA("tesla", "john-account", {})

  const assetID = asaInfo.assetIndex
  await balanceOf(deployer, elonMuskAccount.addr, assetID);

  //await printAssetHolding(deployer, elonMuskAccount.addr, assetID);
  //await printAssetHolding(deployer, johnAccount.addr, assetID);

  console.log("[tesla]: Script execution has finished!")
}

module.exports = { default: run }
