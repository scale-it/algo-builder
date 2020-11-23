/**
 * Description:
 * This file deploys the stateful smart contract to create and transfer NFT
*/
const { executeTransaction } = require("./transfer/common");
const { TransactionType, SignType } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account"); 

  let algoTxnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: johnAccount.addr,
    amountMicroAlgos: 401000000,
    payFlags: {note: "funding account"}
  };

  await executeTransaction(deployer, algoTxnParams); //fund john

  await deployer.deploySSC("nft_approval.py", "nft_clear_state.py", {
    sender: masterAccount,
    localInts: 8,
    localBytes: 8,
    globalInts: 1,
    globalBytes: 63
  }, {});

  const sscInfo = await deployer.getSSC("nft_approval.py", "nft_clear_state.py");
  const appId = sscInfo.appID;
  console.log(sscInfo);

  try {
    await deployer.OptInToSSC(masterAccount, appId, {}); //opt-in to asc by master
    await deployer.OptInToSSC(johnAccount, appId, {});   //opt-in to asc by john
  } catch(e) {
    console.log(e);
    throw new Error(e);
  }
}

module.exports = { default: run }