/**
 * Description:
 * This script demonstrates how to
   - create a signed lsig using sdk and use that lsig to validate transactions
*/
const { transferAlgo } = require("./common");
const { transferMicroAlgos, createMsigAddress } = require("algob");

async function run(runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get("master-account");
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  //Generate multi signature account hash 
  const addrs =  [goldOwnerAccount.addr, johnAccount.addr, bobAccount.addr]
  const [mparams, multsigaddr] = createMsigAddress(1, 2, addrs);   // passing (version, threshold, address list)

  //Get logic Signature
  const lsig = await deployer.loadLogic("sample-asc.teal", []);

  lsig.sign(goldOwnerAccount.sk, mparams);  //lsig signed by gold-owner secret_key
  lsig.appendToMultisig(johnAccount.sk);    //lsig signed again (threshold = 2) by john-account secret_key

  //Funding multisignature account
  await transferMicroAlgos(deployer, masterAccount, multsigaddr, 10000000, {note: "Funding multisig account"});

  // Transaction PASS - according to sample-asc.teal logic, amount should be <= 100
  await transferAlgo(deployer, { addr: multsigaddr }, bobAccount.addr, 58, lsig);

  // Transaction FAIL - according to sample-asc.teal logic, amount should be <= 100
  await transferAlgo(deployer, { addr: multsigaddr }, bobAccount.addr, 580, lsig);
}

module.exports = { default: run }
