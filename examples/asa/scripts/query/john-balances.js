const { printAssets } = require("algob");

async function run(runtimeEnv, deployer) {

  const johnAccount = deployer.accountsByName.get("john-account");

  // print one by one
  //const goldAssetID = deployer.algodClient.asa.get("gold").assetIndex
  //await printAssetHolding(deployer.algodClient, johnAccount.addr, goldAssetID);
  //const teslaAssetID = deployer.algodClient.asa.get("tesla").assetIndex
  //await printAssetHolding(deployer.algodClient, johnAccount.addr, teslaAssetID);

  // print all at once
  await printAssets(deployer, johnAccount.addr)
}

module.exports = { default: run }
