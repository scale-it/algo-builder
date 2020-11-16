const { executeTransaction } = require("algob");
const { mkParam } = require("./transfer/common");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");

  await executeTransaction(deployer, mkParam(masterAccount, goldOwnerAccount.addr, 200000000, {note: "funding account"}));

  await deployer.fundLsig("2-gold-contract-asc.teal", [],
    { funder: goldOwnerAccount, fundingMicroAlgo: 101000 }, {});   // sending 0.101 Algo

  const ascInfoAlgoDelegated = await deployer.mkDelegatedLsig("3-gold-delegated-asc.teal", [],
  goldOwnerAccount);

  const ascInfoGoldDelegated = await deployer.mkDelegatedLsig("4-gold-asa.teal", [],
   goldOwnerAccount); 

  console.log(ascInfoAlgoDelegated);
  console.log(ascInfoGoldDelegated);
  
}

module.exports = { default: run }
