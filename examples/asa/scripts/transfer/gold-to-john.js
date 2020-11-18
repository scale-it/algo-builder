const { executeTransaction, balanceOf, TransactionType, SignType } = require("algob");

async function run(runtimeEnv, deployer) {
  const goldAssetID = deployer.asa.get("gold").assetIndex

  const johnAccount = deployer.accountsByName.get("john-account");
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");

  await executeTransaction(deployer, {
    type: TransactionType.TransferAsset,
    sign: SignType.SecretKey,
    fromAccount: goldOwnerAccount, 
    toAccountAddr: johnAccount.addr, 
    amount: 1,
    assetID: goldAssetID,
    payFlags: {}})

  await balanceOf(deployer, johnAccount.addr, goldAssetID);
}

module.exports = { default: run }
