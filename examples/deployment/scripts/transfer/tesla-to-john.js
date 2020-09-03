const {
  printCreatedAsset,
  printAssetHolding,
  transferMicroAlgos,
  asaOptIn,
  transferAsset
} = require('../../src/asa-helpers');

async function run(runtimeEnv, deployer) {
  const teslaAssetID = deployer.asa.get("tesla").assetIndex

  const johnAccount = deployer.accountsByName.get("john-account");
  const elonMuskAccount = deployer.accountsByName.get("elon-musk-account");

  await transferAsset(deployer, teslaAssetID, elonMuskAccount, johnAccount.addr, 1)

  await printAssetHolding(deployer, johnAccount.addr, teslaAssetID);
}

module.exports = { default: run }
