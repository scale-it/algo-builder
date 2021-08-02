/**
 * Create buyback lsig and store it's address in bond-dapp
 * @param {Deployer object} deployer
 * @param {Account} managerAcc
 */
/* async function createBuyback (deployer, managerAcc) {
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.addr,
    TMPL_BOND: newAsaInfo[assetID]
  };
  buybackLsig = await deployer.loadLogic('buyback-lsig.py', scInitParam);
  await fundAccount(deployer, buybackLsig.address());

  const buybackTx = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: managerAcc,
    appID: appInfo.appID,
    payFlags: {},
    appArgs: ['str:set_buyback', convert.addressToPk(buybackLsig.address())]
  };

  // Only store manager can allow opt-in to ASA for lsig
  const optInTx = [
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: managerAcc,
      toAccountAddr: buybackLsig.address(),
      amountMicroAlgos: 0,
      payFlags: {}
    },
    {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: buybackLsig.address(),
      lsig: buybackLsig,
      assetID: newAsaInfo[assetID],
      payFlags: {}
    }
  ];
  await executeTransaction(deployer, optInTx);

  console.log('Setting buyback address!');
  await executeTransaction(deployer, buybackTx);
  console.log('Buyback address set successfully!');
} */
