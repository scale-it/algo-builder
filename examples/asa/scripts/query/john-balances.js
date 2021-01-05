const { printAssets } = require('@algorand-builder/algob');

async function run (runtimeEnv, deployer) {
  const john = deployer.accountsByName.get('john');

  // print one by one
  // const goldAssetID = deployer.algodClient.asa.get("gold").assetIndex
  // await printAssetHolding(deployer.algodClient, john.addr, goldAssetID);
  // const teslaAssetID = deployer.algodClient.asa.get("tesla").assetIndex
  // await printAssetHolding(deployer.algodClient, john.addr, teslaAssetID);

  // print all at once
  await printAssets(deployer, john.addr);
}

module.exports = { default: run };
