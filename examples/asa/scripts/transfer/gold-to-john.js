const { executeTransaction, balanceOf, TransactionType, SignType } = require('@algorand-builder/algob');

async function run (runtimeEnv, deployer) {
  const goldAssetID = deployer.asa.get('gold').assetIndex;

  const john = deployer.accountsByName.get('john');
  const goldOwner = deployer.accountsByName.get('alice');

  await executeTransaction(deployer, {
    type: TransactionType.TransferAsset,
    sign: SignType.SecretKey,
    fromAccount: goldOwner,
    toAccountAddr: john.addr,
    amount: 1,
    assetID: goldAssetID,
    payFlags: {}
  });

  await balanceOf(deployer, john.addr, goldAssetID);
}

module.exports = { default: run };
