const { transferMicroAlgos, transferAsset, balanceOf } = require("algob");

async function run(runtimeEnv, deployer) {
  const goldAssetID = deployer.asa.get("gold").assetIndex

  const johnAccount = deployer.accountsByName.get("john-account");
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");

  await transferAsset(deployer, goldAssetID, goldOwnerAccount, johnAccount.addr, 1)

  await balanceOf(deployer, johnAccount.addr, goldAssetID);
}

module.exports = { default: run }
