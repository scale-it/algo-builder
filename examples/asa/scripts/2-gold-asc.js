const { executeTransaction, balanceOf, getSuggestedParams, signTransactions } = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { mkParam } = require('./transfer/common');
const { makeAssetTransferTxnWithSuggestedParams } = require('algosdk');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const goldOwner = deployer.accountsByName.get('alice');

  await executeTransaction(deployer, mkParam(masterAccount, goldOwner.addr, 200e6, { note: 'funding account' }));

  await deployer.fundLsig('2-gold-contract-asc.teal',
    { funder: goldOwner, fundingMicroAlgo: 1e6 }, {}); // funding with 1 Algo

  const ascInfoAlgoDelegated = await deployer.mkDelegatedLsig('3-gold-delegated-asc.teal', goldOwner);
  const ascInfoGoldDelegated = await deployer.mkDelegatedLsig('4-gold-asa.teal', goldOwner);

  console.log(ascInfoAlgoDelegated);
  console.log(ascInfoGoldDelegated);

  /* Contract opt-in for ASA gold + fund contract with ASA gold */
  const lsig = await deployer.loadLogic('2-gold-contract-asc.teal');
  const goldAsset = deployer.asa.get('gold');
  const goldAssetID = goldAsset.assetIndex;
  await deployer.optInLsigToASA(goldAssetID, lsig, { totalFee: 1000 });
  await balanceOf(deployer, lsig.address(), goldAssetID);

  console.log(`Funding contract ${lsig.address()} with ASA gold`);
  const tx = makeAssetTransferTxnWithSuggestedParams(
    goldOwner.addr,
    lsig.address(),
    undefined,
    undefined,
    1e5,
    undefined,
    goldAssetID,
    await getSuggestedParams(deployer.algodClient)
  );
  const sign = {
    sign: types.SignType.SecretKey,
    fromAccount: goldOwner
  };

  await executeTransaction(deployer, { transaction: tx, sign: sign });
  await balanceOf(deployer, lsig.address(), goldAssetID);

  // To get raw signed transaction you may use `signTransactions` function
  const _rawSign = signTransactions([{ transaction: tx, sign: sign }]);
}

module.exports = { default: run };
