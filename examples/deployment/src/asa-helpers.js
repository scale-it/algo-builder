const algosdk = require('algosdk');

// Function used to print created asset for account and assetId
exports.printCreatedAsset = async function (deployer, account, assetid) {
  let accountInfo = await deployer.algodClient.accountInformation(account).do();
  for (idx = 0; idx < accountInfo['created-assets'].length; idx++) {
    let scrutinizedAsset = accountInfo['created-assets'][idx];
    if (scrutinizedAsset['index'] == assetid) {
      console.log("Created ASA:", {
        assetIndex: assetid,
        params: scrutinizedAsset['params']
      })
      break;
    }
  }
};

// Print account's ASA info. All at once.
exports.printAssets = async function (deployer, account) {
  let accountInfo = await deployer.algodClient.accountInformation(account).do();
  console.log("Asset Holding Info:", accountInfo['assets']);
  console.log("Account's ALGO (microalgos):", accountInfo["amount-without-pending-rewards"])
}

// Transfer ALGO
exports.transferMicroAlgosContract = async function (deployer, fromAccount, toAccountAddr, amountMicroAlgos, lsig) {

  let params = await deployer.algodClient.getTransactionParams().do();

  const receiver = toAccountAddr.addr;
  let note = algosdk.encodeObj("ALGO PAID");

  let txn = algosdk.makePaymentTxnWithSuggestedParams(
    fromAccount.addr, receiver, amountMicroAlgos, undefined, note, params);

  //let signedTxn = txn.signTxn(fromAccount.sk);
  let signedTxn = algosdk.signLogicSigTransactionObject(txn, lsig);
  let txId = txn.txID().toString();
  console.log(txId);
  const pendingTx = await deployer.algodClient.sendRawTransaction(signedTxn.blob).do();
  console.log("Transferring algo (in micro algos):", {
    from: fromAccount.addr,
    to: receiver,
    amount: amountMicroAlgos,
    txid: pendingTx.txId
  })
  return await deployer.waitForConfirmation(pendingTx.txId)
}
