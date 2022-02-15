const { executeTransaction, balanceOf, signTransactions } = require('@algo-builder/algob');
const { types, getSuggestedParams } = require('@algo-builder/web');
const { mkParam } = require('./transfer/common');
const { makeAssetTransferTxnWithSuggestedParams } = require('algosdk');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const goldOwner = deployer.accountsByName.get('alice');

  await executeTransaction(deployer, mkParam(masterAccount, goldOwner.addr, 200e6, { note: 'funding account' }));

  // save Smart Signature by name & fund the account
  const ascInfoContract = await deployer.mkContractLsig('2-gold-contract-asc.teal', 'Gold_C_Lsig', {});
  console.log(ascInfoContract);
  await deployer.fundLsig('Gold_C_Lsig',
    { funder: goldOwner, fundingMicroAlgo: 1e6 }, {}); // funding with 1 Algo

  const ascInfoAlgoDelegated =
    await deployer.mkDelegatedLsig('3-gold-delegated-asc.teal', 'Gold_D_Lsig', goldOwner);
  const ascInfoGoldDelegated =
    await deployer.mkDelegatedLsig('4-gold-asa.teal', 'Gold_d_asa_lsig', goldOwner);

  console.log(ascInfoAlgoDelegated);
  console.log(ascInfoGoldDelegated);

  /* Contract opt-in for ASA gold + fund contract with ASA gold */
  const lsig = await deployer.getLsig('Gold_C_Lsig');
  const goldAsset = deployer.asa.get('gold');
  const goldAssetID = goldAsset.assetIndex;
  await deployer.optInLsigToASA(goldAssetID, lsig, { totalFee: 1000 });
  console.log('Balance: ', await balanceOf(deployer, lsig.address(), goldAssetID));

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
