/**
 * Description:
 * This file demonstrates the PyTeal Example for HLTC(Hash Time Lock Contract)
*/
const { transferMicroAlgos, transferAsset, balanceOf, ASC1Mode } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const bobAccount = deployer.accountsByName.get("bob-account"); // Buyer

  await transferMicroAlgos(deployer, masterAccount, bobAccount.addr, 200000000, {note: "funding account"});  

  // Secret value // Image : QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=
  const secret = "hero wisdom green split loop element vote belt";
  const hltcInfoAlgoContract = await deployer.fundLsig("hltc.py", [ secret ],
    { funder: bobAccount, fundingMicroAlgo: 202000000 }, {}); 

  console.log(hltcInfoAlgoContract);
  
}

module.exports = { default: run }
