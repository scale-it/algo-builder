const { TransactionType, SignType, toBytes, executeTransaction } = require('algob');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const donorAccount = deployer.accountsByName.get('john');

  await executeTransaction(deployer, {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: donorAccount.addr,
    amountMicroAlgos: 20000000,
    payFlags: {}
  });

  // App argument to donate.
  const appArgs = [toBytes('donate')];

  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC('crowdFundApproval.teal', 'crowdFundClear.teal');

  // Get Escrow Account Address
  const escrowAccount = await deployer.loadLogic('crowdFundEscrow.py', [], { APP_ID: appInfo.appID });
  console.log('Escrow Address: ', escrowAccount.address());

  // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
  const transactions = [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: donorAccount,
      appId: appInfo.appID,
      payFlags: {},
      appArgs: appArgs
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.SecretKey,
      fromAccount: donorAccount,
      toAccountAddr: escrowAccount.address(),
      amountMicroAlgos: 5000000,
      payFlags: {}
    }
  ];

  console.log('Donation transaction in process');
  await executeTransaction(deployer, transactions);
  console.log('Donated!');
}

module.exports = { default: run };
