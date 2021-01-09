const { TransactionType, SignType, stringToBytes, executeTransaction } = require('@algorand-builder/algob');

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

  const appArgs = [stringToBytes('claim')];
  const appInfo = deployer.getSSC('crowdFundApproval.teal', 'crowdFundClear.teal'); // get from checkpoint
  const escrowAccount = await deployer.loadLogic('crowdFundEscrow.py', [], { APP_ID: appInfo.appID });

  // Atomic Transaction (Stateful Smart Contract call + Payment Transaction)
  const txGroup = [
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
  await executeTransaction(deployer, txGroup);
  console.log('Claimed!');
}

module.exports = { default: run };
