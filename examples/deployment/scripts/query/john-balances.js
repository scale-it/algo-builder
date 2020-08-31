const algosdk = require('algosdk');
const {
  printCreatedAsset,
  printAssetHolding,
  transferMicroAlgos,
  asaOptIn,
  transferAsset,
  printAssets
} = require('../../src/asa-helpers');

async function run(runtimeEnv, accounts, deployer) {
  const goldAssetID = deployer.asa.get("gold").assetIndex
  const teslaAssetID = deployer.asa.get("tesla").assetIndex

  const johnAccount = deployer.accountsByName.get("john-account");

  // print one by one
  //await printAssetHolding(deployer, johnAccount.addr, goldAssetID);
  //await printAssetHolding(deployer, johnAccount.addr, teslaAssetID);
  // print all at once
  await printAssets(deployer, johnAccount.addr)
}

module.exports = { default: run }
