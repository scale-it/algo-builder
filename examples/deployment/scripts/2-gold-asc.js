const { transferMicroAlgos, transferAsset, balanceOf } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");

  await transferMicroAlgos(deployer, masterAccount, goldOwnerAccount.addr, 200000000, {note: "ALGO PAID"});

  const ascInfo = await deployer.deployASC("3-gold-asc.teal", [],
    {funder: goldOwnerAccount, fundingMicroAlgo: 101000 }, {}); // sending 0.101 Algo

  console.log(ascInfo);
}

module.exports = { default: run }
