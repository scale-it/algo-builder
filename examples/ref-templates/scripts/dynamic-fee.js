const { executeTransaction, mkTxnParams } = require("./common/common");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  scInitParam = {
    TMPL_TO: johnAccount.addr,  
    TMPL_AMT: 700000,
    TMPL_CLS: masterAccount.addr,
    TMPL_FV: 10,
    TMPL_LV: 1000000,
    TMPL_LEASE: "023sdDE2"
  };
  // setup a contract account and send 1 ALGO from master
  await deployer.fundLsig("dynamic-fee.py", 
  { funder: masterAccount, fundingMicroAlgo: 100000000 }, { closeRemainderTo: masterAccount.addr }, [], scInitParam); 

  let contract = await deployer.loadLogic("dynamic-fee.py", [], scInitParam);
  const escrow = contract.address(); //contract account

  await deployer.mkDelegatedLsig("dynamic-fee.py", masterAccount, [], scInitParam); // sign contract
  const signedContract =  await deployer.getDelegatedLsig('dynamic-fee.py');
  console.log("SIGn1 ", signedContract);

  let transactions = [
    mkTxnParams(masterAccount, escrow, 1000, signedContract, {}),
    mkTxnParams({ addr: escrow}, johnAccount.addr, 700000, contract, { totalFee: 1000, closeRemainderTo: bobAccount.addr })]

  //Group Transaction FAIL - Correct transaction Fee is used BUT closeRemainderTo is set to bob
  await executeTransaction(deployer, transactions);

  transactions = [
    mkTxnParams(masterAccount, escrow, 1000, signedContract, { }),
    mkTxnParams({ addr: escrow}, johnAccount.addr, 700000, contract, { totalFee: 1000, closeRemainderTo: masterAccount.addr })]
  
  //Group Transaction PASS - Correct transaction Fee is used and closeRemainderTo is set to master
  await executeTransaction(deployer, transactions);

}

module.exports = { default: run }
