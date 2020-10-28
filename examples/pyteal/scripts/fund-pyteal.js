/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
*/
const { transferMicroAlgos } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const bobAccount = deployer.accountsByName.get("bob-account"); // Buyer

  await transferMicroAlgos(deployer, masterAccount, bobAccount.addr, 200000000, {note: "funding account"});  

  // secret value hashed with sha256 will produce our image hash : QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=
  const secret = "hero wisdom green split loop element vote belt";
  const htlcInfoAlgoContract = await deployer.fundLsig("htlc.py", [ secret ],
    { funder: bobAccount, fundingMicroAlgo: 202000000 }, {}); 

  console.log(htlcInfoAlgoContract);
  
}

module.exports = { default: run }
