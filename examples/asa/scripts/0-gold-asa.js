const { executeTransaction, balanceOf } = require("algob");
const { mkParam } = require("./transfer/common");
/*
  Create "gold" Algorand Standard Asset (ASA)
  Accounts are loaded from config
  To use ASA accounts have to opt-in and owner is opt-in by default
  john is transferred some funds to execute opt-in transaction
*/
async function run(runtimeEnv, deployer) {
  console.log("[gold]: Script has started execution!")

  const masterAccount = deployer.accountsByName.get("master-account")
  const goldOwner = deployer.accountsByName.get("alice");
  const john = deployer.accountsByName.get("john");
  const bob = deployer.accountsByName.get("bob")
  // activate goldOwner and john accounts
  let promises = [
    executeTransaction(deployer, mkParam(masterAccount, goldOwner.addr, 401000000, {note: "funding account"})),
    executeTransaction(deployer, mkParam(masterAccount, john.addr, 401000000, {note: "funding account"})),
    executeTransaction(deployer, mkParam(masterAccount, bob.addr, 1000000, {note: "funding account"}))]
  await Promise.all(promises)

  const asaInfo = await deployer.deployASA("gold", {
    creator: goldOwner
    //totalFee: 1001,
    //feePerByte: 100,
    //firstValid: 10,
    //validRounds: 1002
  })
  console.log(asaInfo) 
  await deployer.optInToASA("gold", "bob", {});
  const assetID = asaInfo.assetIndex
  await balanceOf(deployer, goldOwner.addr, assetID);

  //await printAssetHolding(deployer, goldOwner.addr, assetID);
  //await printAssetHolding(deployer, john.addr, assetID);

  console.log("[gold]: Script execution has finished!")
}

module.exports = { default: run }
