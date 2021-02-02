const { executeTransaction, balanceOf } = require('@algorand-builder/algob');
const { TransactionType, SignType } = require('@algorand-builder/runtime/build/types');

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
