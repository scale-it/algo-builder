const { TransactionType, SignType } = require("algob");
const { executeTransaction } = require("./common");

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const aliceAccount = deployer.accountsByName.get("alice-account");
  const votingAdminAccount = deployer.accountsByName.get("voting-admin-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  await executeTransaction(deployer, {type:TransactionType.TransferAlgo, sign:SignType.SecretKey,
   fromAccount: masterAccount, toAccountAddr:aliceAccount.addr, amountMicroAlgos: 200000000, payFlags: {}});

  // Get last round.
  const status = await deployer.algodClient.status().do();
  console.log("Last Round: ", status['last-round']);

  // App arguments to vote for "candidatea".
  appArgs = [
    new Uint8Array(Buffer.from('vote')), 
    new Uint8Array(Buffer.from('candidatea'))
  ];

  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC("permissioned-voting-approval.py", "permissioned-voting-clear.py");
  const voteAssetID = deployer.asa.get("vote-token").assetIndex;

  // Atomic Transaction (Stateful Smart Contract call + Asset Transfer)
  let transactions = [
    {type: TransactionType.CallNoOpSSC, sign: SignType.SecretKey, fromAccount: aliceAccount,
    appId: appInfo.appID, payFlags: {}, appArgs},
    {type: TransactionType.TransferAsset, sign: SignType.SecretKey, fromAccount: aliceAccount,
    toAccountAddr: votingAdminAccount.addr, amount: 1, assetID: voteAssetID,
    payFlags: {}}
  ];

  // Transaction Passes because Alice is registered voter and hasn't voted yet. 
  console.log("Vote being casted by Alice");
  await executeTransaction(deployer, transactions);

  // Transaction Fails because Alice can only vote once. 
  console.log("Alice tries to cast vote again");
  await executeTransaction(deployer, transactions);

  // Transaction Fails because bob is not registered voter.
  console.log("Bob tries to cast vote");
  transactions[0].fromAccount = bobAccount;
  transactions[1].fromAccount = bobAccount;

  await executeTransaction(deployer, transactions);

}

module.exports = { default: run }
