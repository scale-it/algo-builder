const { TransactionType, SignType, toBytes } = require('algob');
const { executeTransaction } = require('./common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const creatorAccount = deployer.accountsByName.get('alice');

  await executeTransaction(deployer, {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: creatorAccount.addr,
    amountMicroAlgos: 5000000,
    payFlags: {}
  });

  // App argument to claim.
  const appArgs = [toBytes('claim')];

  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC('crowdFund.teal', 'crowdFundClose.teal');

  // Get Escrow Account Address
  const escrowAccount = await deployer.loadLogic('crowdFundEscrow.py', [], { APP_ID: appInfo.appID });

  // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
  const transactions = [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: creatorAccount,
      appId: appInfo.appID,
      payFlags: {},
      appArgs: appArgs
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.LogicSignature,
      fromAccount: { addr: escrowAccount.address() },
      toAccountAddr: creatorAccount.addr,
      amountMicroAlgos: 0,
      lsig: escrowAccount,
      payFlags: { closeRemainderTo: creatorAccount.addr }
    }
  ];

  console.log('Claim transaction in process');
  await executeTransaction(deployer, transactions);
  console.log('Claimed!');
}

module.exports = { default: run };
