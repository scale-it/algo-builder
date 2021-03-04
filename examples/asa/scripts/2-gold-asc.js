const { executeTransaction, balanceOf } = require('@algorand-builder/algob');
const { types } = require('@algorand-builder/runtime');
const { mkParam } = require('./transfer/common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const goldOwner = deployer.accountsByName.get('alice');

  await executeTransaction(deployer, mkParam(masterAccount, goldOwner.addr, 200e6, { note: 'funding account' }));

  await deployer.fundLsig('2-gold-contract-asc.teal',
    { funder: goldOwner, fundingMicroAlgo: 1e6 }, {}, []); // funding with 1 Algo

  const ascInfoAlgoDelegated = await deployer.mkDelegatedLsig('3-gold-delegated-asc.teal',
    goldOwner, []);
  const ascInfoGoldDelegated = await deployer.mkDelegatedLsig('4-gold-asa.teal',
    goldOwner, []);

  console.log(ascInfoAlgoDelegated);
  console.log(ascInfoGoldDelegated);

  /* Contract opt-in for ASA gold + fund contract with ASA gold */
  const lsig = await deployer.loadLogic('2-gold-contract-asc.teal', []);
  const goldAsset = deployer.asa.get('gold');
  const goldAssetID = goldAsset.assetIndex;

  await deployer.optInLsigToASA('gold', lsig, { totalFee: 1000 });
  await balanceOf(deployer, lsig.address(), goldAssetID);

  console.log(`Funding contract ${lsig.address()} with ASA gold`);
  await executeTransaction(deployer, {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: goldOwner,
    toAccountAddr: lsig.address(),
    amount: 1e5,
    assetID: goldAssetID,
    payFlags: { totalFee: 1000 }
  });

  await balanceOf(deployer, lsig.address(), goldAssetID);
}

module.exports = { default: run };
