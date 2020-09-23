const {
  printCreatedAsset,
  asaOptIn
} = require('../src/asa-helpers');
const { transferMicroAlgos, transferAsset, balanceOf } = require("algob");
/*
  Create "gold" Algorand Standard Asset (ASA)
  Accounts are loaded from config
  To use ASA accounts have to opt-in and owner is opt-in by default
  john-account is transferred some funds to execute opt-in transaction
*/
async function run(runtimeEnv, deployer) {
  console.log("[gold]: Script has started execution!")

  const masterAccount = deployer.accountsByName.get("master-account")
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");

  // activate goldOwner and john accounts
  let promises = [
    transferMicroAlgos(deployer, masterAccount, goldOwnerAccount.addr, 401000000, {note: "ALGO PAID"}),
    transferMicroAlgos(deployer, masterAccount, johnAccount.addr, 401000000, {note: "ALGO PAID"})]
  await Promise.all(promises)

  const asaInfo = await deployer.deployASA("gold", {
    creator: goldOwnerAccount
    //totalFee: 1001,
    //feePerByte: 100,
    //firstValid: 10,
    //validRounds: 1002
  })
  console.log(asaInfo)

  const assetID = asaInfo.assetIndex
  await balanceOf(deployer, goldOwnerAccount.addr, assetID);

  //await printAssetHolding(deployer, goldOwnerAccount.addr, assetID);
  //await printAssetHolding(deployer, johnAccount.addr, assetID);

  console.log("[gold]: Script execution has finished!")
}

module.exports = { default: run }
