const { stringToBytes, executeTransaction } = require('@algorand-builder/algob');
const { types } = require('@algorand-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const donorAccount = deployer.accountsByName.get('john');

  await executeTransaction(deployer, {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: donorAccount.addr,
    amountMicroAlgos: 20000000,
    payFlags: {}
  });

  // App argument to donate.
  const appArgs = [stringToBytes('donate')];

  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC('crowdFundApproval.teal', 'crowdFundClear.teal');

  // Get Escrow Account Address
  const escrowAccount = await deployer.loadLogic('crowdFundEscrow.py', [], { APP_ID: appInfo.appID });
  console.log('Escrow Address: ', escrowAccount.address());

  const txGroup = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: donorAccount,
      appId: appInfo.appID,
      payFlags: {},
      appArgs: appArgs
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: donorAccount,
      toAccountAddr: escrowAccount.address(),
      amountMicroAlgos: 5000000,
      payFlags: {}
    }
  ];

  console.log('Donation transaction in process');
  await executeTransaction(deployer, txGroup);
  console.log('Donated!');
}

module.exports = { default: run };
