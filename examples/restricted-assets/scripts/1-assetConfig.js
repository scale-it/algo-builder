const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const creator = deployer.accountsByName.get('alice');

  // NOTE: make sure to deploy 0-createAppAsset.js first
  const appInfo = deployer.getSSC('poi-approval.teal', 'poi-clear.teal');
  const assetInfo = deployer.asa.get('gold');

  /** * Compile and fund escrow***/
  const escrowParams = {
    ASSET_ID: assetInfo.assetIndex,
    APP_ID: appInfo.appID
  };

  await deployer.fundLsig('clawback-escrow.py',
    { funder: creator, fundingMicroAlgo: 1e6 }, {}, [], escrowParams); // sending 1 Algo

  const escrowLsig = await deployer.loadLogic('clawback-escrow.py', [], escrowParams);
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

  /** now lock the asset by clearing the manager and freeze account **/
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
