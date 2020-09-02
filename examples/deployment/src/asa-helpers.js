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

// Print specific account's ASA info.
exports.printAssetHolding = async function (deployer, account, assetid) {
  let accountInfo = await deployer.algodClient.accountInformation(account).do();
  for (const asset of accountInfo['assets']) {
    if (asset['asset-id'] == assetid) {
      console.log("Asset Holding Info:", asset, accountInfo);
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
exports.transferMicroAlgos = async function (deployer, fromAccount, toAccountAddr, amountMicroAlgos) {

  let params = await deployer.algodClient.getTransactionParams().do();

  const receiver = toAccountAddr;
  let note = algosdk.encodeObj("ALGO PAID");

  let txn = algosdk.makePaymentTxnWithSuggestedParams(
    fromAccount.addr, receiver, amountMicroAlgos, undefined, note, params);

  let signedTxn = txn.signTxn(fromAccount.sk);
  let txId = txn.txID().toString();
  const pendingTx = await deployer.algodClient.sendRawTransaction(signedTxn).do();
  console.log("Transferring algo (in micro algos):", {
    from: fromAccount.addr,
    to: receiver,
    amount: amountMicroAlgos,
    txid: pendingTx.txId
  })
  return await deployer.waitForConfirmation(pendingTx.txId)
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


exports.asaOptIn = async function (deployer, optInAccount, assetID) {
  // Opting in to an Asset:
  // Opting in to transact with the new asset
  // Allow accounts that want recieve the new asset
  // Have to opt in. To do this they send an asset transfer
  // of the new asset to themselves

  // First update changing transaction parameters
  // We will account for changing transaction parameters
  // before every transaction in this example
  params = await deployer.algodClient.getTransactionParams().do();

  let sender = optInAccount.addr;
  let recipient = sender
  // We set revocationTarget to undefined as
  // This is not a clawback operation
  let revocationTarget = undefined;
  // CloseReaminerTo is set to undefined as
  // we are not closing out an asset
  let closeRemainderTo = undefined;
  // We are sending 0 assets
  const note = undefined;

  // transferring 0 will enable future transfers
  const amount = 0;

  // signing and sending "txn" allows sender to begin accepting asset specified by creator and index
  let opttxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget,
    amount, note, assetID, params);

  // Must be signed by the account wishing to opt in to the asset
  rawSignedTxn = opttxn.signTxn(optInAccount.sk);
  let opttx = (await deployer.algodClient.sendRawTransaction(rawSignedTxn).do());
  console.log("ASA Opt-in:", {
    forAccount: sender,
    assetID: assetID,
    txId: opttx.txId
  })
  // wait for transaction to be confirmed
  return await deployer.waitForConfirmation(opttx.txId);
}

exports.transferAsset = async function (deployer, assetID, fromAccount, toAccountAddr, amount) {
  // Transfer New Asset:

  // First update changing transaction parameters
  // We will account for changing transaction parameters
  // before every transaction in this example

  params = await deployer.algodClient.getTransactionParams().do();

  sender = fromAccount;
  recipient = toAccountAddr;
  revocationTarget = undefined;
  closeRemainderTo = undefined;
  note = undefined;
  //Amount of the asset to transfer

  // signing and sending "txn" will send "amount" assets from "sender" to "recipient"
  let xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender.addr, recipient, closeRemainderTo, revocationTarget,
    amount,  note, assetID, params);
  // Must be signed by the account sending the asset
  rawSignedTxn = xtxn.signTxn(sender.sk)
  let xtx = (await deployer.algodClient.sendRawTransaction(rawSignedTxn).do());
  console.log("Transferring:", {
    from: sender.addr,
    to: recipient,
    amount: amount,
    assetID: assetID,
    txId: xtx.txId
  })
  // wait for transaction to be confirmed
  await deployer.waitForConfirmation(xtx.txId);
}
