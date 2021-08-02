const { types } = require('@algo-builder/web');

/**
 * Redeem old tokens, get coupon_value + new bond tokens
 * @param {Account} buyerAccount
 */
/* async function redeem (deployer, buyerAccount, managerAcc) {
  const scInitParam = {
    TMPL_OLD_BOND: asaInfo.assetIndex,
    TMPL_NEW_BOND: newAsaInfo[assetID],
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const dexLsig = await deployer.loadLogic('dex-lsig.py', scInitParam);
  await deployer.optInAcountToASA(newAsaInfo[assetID], 'bob', {});
  const groupTx = [
    // Transfer tokens to dex lsig.
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      toAccountAddr: dexLsig.address(),
      amount: 10,
      assetID: asaInfo.assetIndex,
      payFlags: { totalFee: 3000 }
    },
    // New bond token transfer to buyer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.addr,
      amount: 10,
      assetID: newAsaInfo[assetID],
      payFlags: { totalFee: 0 }
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.addr,
      amountMicroAlgos: 200,
      payFlags: { totalFee: 0 }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      appID: appInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:redeem_coupon']
    }
  ];

  console.log('Redeeming tokens!');
  await executeTransaction(deployer, groupTx);
  console.log('Tokens redeemed!');
} */
