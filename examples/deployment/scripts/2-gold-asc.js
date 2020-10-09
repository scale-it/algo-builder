const { transferMicroAlgos, transferAsset, balanceOf } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");

  await transferMicroAlgos(deployer, masterAccount, goldOwnerAccount.addr, 200000000, {note: "funding account"});

  const ascInfoGold = await deployer.deployASC("4-gold-asa.teal", [],
    {funder: goldOwnerAccount, fundingMicroAlgo: 101000 }, {}); // sending 0.101 Algo

  const ascInfoAlgo = await deployer.deployASC("3-gold-asc.teal", [],
  {funder: goldOwnerAccount, fundingMicroAlgo: 101000 }, {}); // sending 0.101 Algo

  console.log(ascInfoGold);
  console.log(ascInfoAlgo);
}

module.exports = { default: run }
