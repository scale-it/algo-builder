/**
 * Description:
 * This file deploys the stateful smart contract to create and transfer NFT
*/
const { executeTransaction } = require("./transfer/common");
const { TransactionType, SignType } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const bobAccount = deployer.accountsByName.get("bob-account"); 
  const johnAccount = deployer.accountsByName.get("john-account"); 

  let algoTxnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: johnAccount.addr,
    amountMicroAlgos: 401000000,
    payFlags: {note: "funding account"}
  };

  await executeTransaction(deployer, algoTxnParams);

  algoTxnParams.toAccountAddr = bobAccount.addr;
  await executeTransaction(deployer, algoTxnParams);

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