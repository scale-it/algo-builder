const { TransactionType, SignType, executeTransaction } = require('@algorand-builder/algob');

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

  const appInfo = deployer.getSSC('crowdFundApproval.teal', 'crowdFundClear.teal');
  const lsig = await deployer.loadLogic('crowdFundEscrow.py', [], { APP_ID: appInfo.appID });
  const escrowAccountAddress = lsig.address();

  // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
  const txGroup = [
    {
      type: TransactionType.DeleteSSC,
      sign: SignType.SecretKey,
      fromAccount: creatorAccount,
      appId: appInfo.appID,
      payFlags: {},
      appArgs: [],
      accounts: [escrowAccountAddress] //  AppAccounts
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.LogicSignature,
      fromAccount: { addr: escrowAccountAddress },
      toAccountAddr: creatorAccount.addr,
      amountMicroAlgos: 0,
      lsig: lsig,
      payFlags: { closeRemainderTo: creatorAccount.addr }
    }
  ];

  console.log('Deleting Application transaction in process');
  await executeTransaction(deployer, txGroup);
  console.log('Application Deleted and Fund transferred to creator account');
}

module.exports = { default: run };
