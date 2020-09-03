const {
  printCreatedAsset,
  printAssetHolding,
  transferMicroAlgos,
  asaOptIn,
  transferAsset
} = require('../src/asa-helpers');
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

  await transferMicroAlgos(deployer, masterAccount, elonMuskAccount.addr, 1000000)
  await transferMicroAlgos(deployer, masterAccount, johnAccount.addr, 1000000)

  const asaInfo = await deployer.deployASA("tesla", {
    creator: elonMuskAccount
    //totalFee: 1001,
    //feePerByte: 10,
    //firstValid: 10,
    //validRounds: 1002
  })
  console.log(asaInfo)

  const assetID = asaInfo.assetIndex
  await printCreatedAsset(deployer, elonMuskAccount.addr, assetID);

  await asaOptIn(deployer, johnAccount, assetID)

  //await printAssetHolding(deployer, elonMuskAccount.addr, assetID);
  //await printAssetHolding(deployer, johnAccount.addr, assetID);

  console.log("[tesla]: Script execution has finished!")
}

module.exports = { default: run }
