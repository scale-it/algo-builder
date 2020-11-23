/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
*/
const { executeTransaction, TransactionType, SignType } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const bobAccount = deployer.accountsByName.get("bob-account"); // Buyer

  let txnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: bobAccount.addr,
    amountMicroAlgos: 200000000,
    payFlags: {note: "funding account"}
  }
  await executeTransaction(deployer, txnParams);
  // secret value hashed with sha256 will produce our image hash : QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=
  const secret = "hero wisdom green split loop element vote belt";
  
  await deployer.fundLsig("htlc.py",
    { funder: bobAccount, fundingMicroAlgo: 202000000 }, {}, [ secret ]); 
  
}

module.exports = { default: run }
