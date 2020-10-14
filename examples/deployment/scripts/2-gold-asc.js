const { transferMicroAlgos, transferAsset, balanceOf, ASC1Mode } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");

  await transferMicroAlgos(deployer, masterAccount, goldOwnerAccount.addr, 200000000, {note: "funding account"});

  const ascInfoGold = await deployer.deployASC("4-gold-asa.teal", [],
    { funder: goldOwnerAccount, fundingMicroAlgo: 101000, mode: ASC1Mode.DELEGATED_APPROVAL }, {}); // sending 0.101 Algo

  const ascInfoAlgoDelegated = await deployer.deployASC("3-gold-delegated-asc.teal", [],
    { funder: goldOwnerAccount, fundingMicroAlgo: 101000, mode: ASC1Mode.DELEGATED_APPROVAL }, {}); // sending 0.101 Algo

  const ascInfoAlgoContract = await deployer.deployASC("2-gold-contract-asc.teal", [],
    { funder: goldOwnerAccount, fundingMicroAlgo: 101000, mode: ASC1Mode.DELEGATED_APPROVAL }, {});   // sending 0.101 Algo

  console.log(ascInfoGold);
  console.log(ascInfoAlgoDelegated);
  console.log(ascInfoAlgoContract);
}

module.exports = { default: run }
