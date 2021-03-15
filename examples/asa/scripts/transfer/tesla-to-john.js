const { executeTransaction, balanceOf } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const teslaAssetID = deployer.asa.get('tesla').assetIndex;

  const john = deployer.accountsByName.get('john');
  const elon = deployer.accountsByName.get('elon-musk');

  await executeTransaction(deployer, {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: elon,
    toAccountAddr: john.addr,
    amount: 184467440737095516n, // use bigint for large transfer amount
    assetID: teslaAssetID,
    payFlags: {}
  });

  await balanceOf(deployer, john.addr, teslaAssetID);
}

module.exports = { default: run };
