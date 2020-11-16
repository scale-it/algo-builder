/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
*/
const { transferMicroAlgos } = require("algob");
const { default: deploy } = require("algob/build/builtin-tasks/deploy");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const bobAccount = deployer.accountsByName.get("bob-account"); 
  const johnAccount = deployer.accountsByName.get("john-account"); 

  transferMicroAlgos(deployer, masterAccount, johnAccount.addr, 401000000, {note: "funding account"});
  transferMicroAlgos(deployer, masterAccount, bobAccount.addr, 401000000, {note: "funding account"});

  await deployer.deploySSC("approval_program.teal", "clear_state_program.teal", {
    sender: masterAccount,
    localInts: 0,
    localBytes: 16,
    globalInts: 1,
    globalBytes: 63
  }, {});

  const sscInfo = await deployer.getSSC("approval_program.teal", "clear_state_program.teal");
  const appId = sscInfo.appID;
  console.log(sscInfo);

  //opt-in to ssc by master, bob, john
  await deployer.OptInToSSC(masterAccount, appId, {});
  await deployer.OptInToSSC(johnAccount, appId, {});
  await deployer.OptInToSSC(bobAccount, appId, {});
}

module.exports = { default: run }
