const { executeTransaction } = require('@algorand-builder/algob');
const { types } = require('@algorand-builder/runtime');

async function run (runtimeEnv, deployer) {
  const creator = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  // ...
  const appInfo = deployer.getSSC('poi.teal', 'poi-clear.teal');
  const assetInfo = deployer.asa.get('gold');
  const escrowLsig = await deployer.loadLogic('clawback-escrow.teal', []);
  const escrowAddress = escrowLsig.address();

  const txGroup = [
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: creator,
      appId: appInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:check-level'],
      accounts: [bob.addr] //  AppAccounts
    },
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creator,
      recipient: bob.addr,
      assetID: assetInfo.assetIndex,
      revocationTarget: escrowAddress,
      amount: 1000,
      // lsig: escrowLsig,
      payFlags: { totalFee: 1000 }
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: creator,
      toAccountAddr: escrowAddress,
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    }
  ];

  try {
    await executeTransaction(deployer, txGroup);
  } catch (error) {
    console.log('Error: ', error.response.error);
  }
}

module.exports = { default: run };
