const { stringToBytes, executeTransaction } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const donorAccount = deployer.accountsByName.get('john');

  await executeTransaction(deployer, {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: donorAccount.addr,
    amountMicroAlgos: 5000000,
    payFlags: {}
  });

  // App argument to claim.
  const appArgs = [stringToBytes('reclaim')];

  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC('crowdFundApproval.teal', 'crowdFundClear.teal');

  // Get Escrow Account Address
  const lsig = await deployer.loadLogic('crowdFundEscrow.py', { APP_ID: appInfo.appID });
  const escrowAccountAddress = lsig.address();

  const txGroup = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: donorAccount,
      appId: appInfo.appID,
      payFlags: {},
      appArgs: appArgs,
      accounts: [escrowAccountAddress] //  AppAccounts
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: escrowAccountAddress,
      toAccountAddr: donorAccount.addr,
      amountMicroAlgos: 50000, // This amount should be (amount donated - fee)
      lsig: lsig,
      payFlags: { }
    }
  ];

  console.log('Reclaim transaction in process');
  await executeTransaction(deployer, txGroup);
  console.log('Reclaimed by ', donorAccount.addr);
}

module.exports = { default: run };
