const { executeTransaction } = require("./common");
const { TransactionType, SignType, toBytes } = require("algob");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account");

  const sscInfo = await deployer.getSSC("nft_approval.py", "nft_clear_state.py");
  const appId = sscInfo.appID;
  console.log(sscInfo);

  const nft_ref = "https://new-nft.com";

  //push arguments "create" and nft data 
  let appArgs = [ toBytes("create"), toBytes(nft_ref) ];
 
  let txnParam = {
    type: TransactionType.CallNoOpSSC,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    appId: appId,
    payFlags: {},
    appArgs
  };

 await executeTransaction(deployer, txnParam); // call to create new nft (with id = 1)
  
  // push arguments "transfer", 1 (NFT ID)
  appArgs = [
    toBytes("transfer"),
    new Uint8Array(8).fill(1, 7), //[0, 0, 0, 0, 0, 0, 0, 1]
  ];

  // account_A = master, account_B = john
  const accounts = [masterAccount.addr, johnAccount.addr];

  txnParam = {
    type: TransactionType.CallNoOpSSC,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    appId: appId,
    payFlags: {},
    appArgs,
    accounts
  };

  //call to transfer nft from master to john
  await executeTransaction(deployer, txnParam); 
}

module.exports = { default: run }