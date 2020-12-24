const { TransactionType, SignType, toBytes } = require('algob');
const { executeTransaction } = require('./common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const donorAccount = deployer.accountsByName.get('john');

  await executeTransaction(deployer, {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: donorAccount.addr,
    amountMicroAlgos: 5000000,
    payFlags: {}
  });

  // App argument to claim.
  const appArgs = [toBytes('reclaim')];

  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC('crowdFundApproval.teal', 'crowdFundClear.teal');

  // Get Escrow Account Address
  const lsig = await deployer.loadLogic('crowdFundEscrow.py', [], { APP_ID: appInfo.appID });
  const escrowAccountAddress = lsig.address();

  // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
  const transactions = [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: donorAccount,
      appId: appInfo.appID,
      payFlags: {},
      appArgs: appArgs,
      accounts: [escrowAccountAddress] //  AppAccounts
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.LogicSignature,
      fromAccount: { addr: escrowAccountAddress },
      toAccountAddr: donorAccount.addr,
      amountMicroAlgos: 50000, // This amount should be (amount donated - fee)
      lsig: lsig,
      payFlags: { }
    }
  ];

  console.log('Reclaim transaction in process');
  await executeTransaction(deployer, transactions);
  console.log('Reclaimed by ', donorAccount.addr);
}

module.exports = { default: run };
