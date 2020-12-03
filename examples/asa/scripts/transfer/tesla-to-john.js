const { executeTransaction, balanceOf, TransactionType, SignType } = require('algob');

async function run (runtimeEnv, deployer) {
  const teslaAssetID = deployer.asa.get('tesla').assetIndex;

  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  await executeTransaction(deployer, {
    type: TransactionType.TransferAsset,
    sign: SignType.SecretKey,
    fromAccount: elon,
    toAccountAddr: john.addr,
    amount: 1,
    assetID: teslaAssetID,
    payFlags: {}
  });

  await balanceOf(deployer, john.addr, teslaAssetID);
}

module.exports = { default: run };
