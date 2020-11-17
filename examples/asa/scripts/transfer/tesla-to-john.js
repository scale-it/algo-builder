const { executeTransaction, balanceOf, TransactionType, SignType } = require("algob");

async function run(runtimeEnv, deployer) {
  const teslaAssetID = deployer.asa.get("tesla").assetIndex

  const johnAccount = deployer.accountsByName.get("john-account");
  const elonMuskAccount = deployer.accountsByName.get("elon-musk-account");

  await executeTransaction(deployer, {
    type: TransactionType.TransferAsset,
    sign: SignType.SecretKey,
    fromAccount: elonMuskAccount, 
    toAccountAddr: johnAccount.addr, 
    amount: 1,
    assetID: teslaAssetID,
    payFlags: {}});

  await balanceOf(deployer, johnAccount.addr, teslaAssetID);
}

module.exports = { default: run }
