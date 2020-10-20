/**
 * Description:
 * This file demonstrates the example to
   - create a signed lsig using sdk and use that lsig to validate transactions
*/
const { transferAlgo } = require("../transfer/common");
const { transferMicroAlgos, getmultisigAddress } = require("algob");

async function run(runtimeEnv, deployer) {
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");


  //Generate multi signature account hash 
  const addrs =  [goldOwnerAccount.addr, johnAccount.addr, bobAccount.addr]
  const [mparams, multsigaddr] = getmultisigAddress(1, 2, addrs);   // passing (version, threshold, address list)

  //Get logic Signature
  const lsig = await deployer.loadLsig("3-gold-delegated-asc.teal", []);

  lsig.sign(goldOwnerAccount.sk, mparams);  //lsig signed by gold-owner secret_key
  lsig.appendToMultisig(johnAccount.sk);    //lsig signed again (threshold = 2) by john-account secret_key

  //Funding multisignature account
  await transferMicroAlgos(deployer, goldOwnerAccount, multsigaddr, 10000000, {note: "Funding multisig account"});

  // Transaction PASS - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, { addr: multsigaddr }, bobAccount.addr, 58, lsig);

  // Transaction FAIL - As according to .teal logic, amount should be <= 100
  await transferAlgo(deployer, { addr: multsigaddr }, bobAccount.addr, 580, lsig);
}

module.exports = { default: run }
