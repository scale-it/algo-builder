// Buyer's exit from bond
/* async function exitBuyer (deployer, buyerAccount) {
  const exitAmount = 10 * 1000 - 1000;
  const exitTx = [
    //  Bond token transfer to buyback address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      toAccountAddr: buybackLsig.address(),
      amount: 10,
      assetID: newAsaInfo[assetID],
      payFlags: { totalFee: 2000 }
    },
    // Nominal price * amount paid to buyer
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: buybackLsig.address(),
      lsig: buybackLsig,
      toAccountAddr: buyerAccount.addr,
      amountMicroAlgos: exitAmount,
      payFlags: { totalFee: 0 }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      appID: appInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:exit']
    }
  ];

  console.log('Exiting');
  await executeTransaction(deployer, exitTx);
  console.log('Exited');
} */
