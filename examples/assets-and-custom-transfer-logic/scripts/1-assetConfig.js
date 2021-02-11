const {
  executeTransaction
} = require('@algorand-builder/algob');
const { types } = require('@algorand-builder/runtime');

async function run (runtimeEnv, deployer) {
  const creator = deployer.accountsByName.get('alice');

  // NOTE: make sure to deploy 0-createAppAsset.js first
  const assetInfo = deployer.asa.get('gold');

  /** * Compile and fund the escrow***/
  await deployer.fundLsig('clawback-escrow.teal',
    { funder: creator, fundingMicroAlgo: 1e6 }, {}, []); // sending 1 Algo

  const escrowLsig = await deployer.loadLogic('clawback-escrow.teal', []);
  const escrowAddress = escrowLsig.address();

  const assetModFields = {
    manager: creator.addr,
    reserve: creator.addr,
    freeze: creator.addr,
    clawback: escrowAddress
  };

  /** Update clawback address to escrow **/
  console.log('* Updating asset clawback to escrow *');
  const assetConfigParams = {
    type: types.TransactionType.ModifyAsset,
    sign: types.SignType.SecretKey,
    fromAccount: creator,
    assetID: assetInfo.assetIndex,
    fields: assetModFields,
    payFlags: { totalFee: 1000 }
  };
  await executeTransaction(deployer, assetConfigParams);

  /** now lock the asset by clearing the manager and freezer **/
  console.log('* Locking the manager and freeze address *');
  const assetLockParams = {
    ...assetConfigParams,
    fields: {
      ...assetModFields,
      manager: '',
      freeze: ''
    }
  };
  await executeTransaction(deployer, assetLockParams);
}

module.exports = { default: run };
