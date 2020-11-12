import type { Account, Account as AccountSDK, LogicSig } from "algosdk";
import tx from "algosdk";
import { TextEncoder } from "util";

import {
  AlgobDeployer,
  ASADef,
  ASADeploymentFlags,
  TxParams
} from "../types";
import { ALGORAND_MIN_TX_FEE } from "./algo-operator";

export async function getSuggestedParams (algocl: tx.Algodv2): Promise<tx.SuggestedParams> {
  const params = await algocl.getTransactionParams().do();
  // Private chains may have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Suggested params returned 0 as firstRound. Ensure that your node progresses.");
    // params.firstRound = 1
  }
  return params;
}

export async function mkSuggestedParams (
  algocl: tx.Algodv2, userDefaults: TxParams): Promise<tx.SuggestedParams> {
  const s = await getSuggestedParams(algocl);

  s.flatFee = userDefaults.totalFee !== undefined;
  s.fee = userDefaults.totalFee ?? userDefaults.feePerByte ?? ALGORAND_MIN_TX_FEE;
  if (s.flatFee) s.fee = Math.max(s.fee, ALGORAND_MIN_TX_FEE);

  s.firstRound = userDefaults.firstValid ?? s.firstRound;
  s.lastRound = userDefaults.firstValid === undefined || userDefaults.validRounds === undefined
    ? s.lastRound
    : userDefaults.firstValid + userDefaults.validRounds;
  return s;
}

export function makeAssetCreateTxn (
  name: string, asaDef: ASADef, flags: ASADeploymentFlags, txSuggestedParams: tx.SuggestedParams
): tx.Transaction {
  // If TxParams has noteb64 or note , it gets precedence
  let note;
  if (flags.noteb64 ?? flags.note) {
    // TxParams note
    note = encodeNote(flags.note, flags.noteb64);
  } else if (asaDef.noteb64 ?? asaDef.note) {
    // ASA definition note
    note = encodeNote(asaDef.note, asaDef.noteb64);
  }

  // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
  return tx.makeAssetCreateTxnWithSuggestedParams(
    flags.creator.addr,
    note,
    asaDef.total,
    asaDef.decimals,
    asaDef.defaultFrozen,
    asaDef.manager,
    asaDef.reserve,
    asaDef.freeze,
    asaDef.clawback,
    asaDef.unitName,
    name,
    asaDef.url,
    asaDef.metadataHash,
    txSuggestedParams
  );
}

export function makeASAOptInTx (
  addr: string,
  assetID: number,
  params: tx.SuggestedParams
): tx.Transaction {
  const closeRemainderTo = undefined;
  const revocationTarget = undefined;
  const amount = 0;
  const note = undefined;
  return tx.makeAssetTransferTxnWithSuggestedParams(
    addr,
    addr,
    closeRemainderTo,
    revocationTarget,
    amount,
    note,
    assetID,
    params);
}

export function encodeNote (note: string | undefined, noteb64: string| undefined): Uint8Array | undefined {
  if (note === undefined && noteb64 === undefined) { return undefined; }
  const encoder = new TextEncoder();
  return noteb64 ? encoder.encode(noteb64) : encoder.encode(note);
}

/**
  * Description:
  * This function is used to transfer Algos
  * from one account to another using fromAccount secret key (for signing)

  * Returns:
  * Transaction details
*/
export async function transferMicroAlgos (
  deployer: AlgobDeployer,
  from: AccountSDK,
  to: string,
  amountMicroAlgos: number,
  param: TxParams
): Promise<tx.ConfirmedTxInfo> {
  const params = await mkSuggestedParams(deployer.algodClient, param);

  const receiver = to;
  let note;
  if (param.noteb64 ?? param.note) {
    note = encodeNote(param.note, param.noteb64);
  } else {
    note = undefined;
  }

  const txn = tx.makePaymentTxnWithSuggestedParams(
    from.addr, receiver, amountMicroAlgos, undefined, note, params);

  const signedTxn = txn.signTxn(from.sk);
  const pendingTx = await deployer.algodClient.sendRawTransaction(signedTxn).do();
  console.log("Transferring algo (in micro algos):", {
    from: from.addr,
    to: receiver,
    amount: amountMicroAlgos,
    txid: pendingTx.txId
  });
  return await deployer.waitForConfirmation(pendingTx.txId);
}
/**
  * Description:
  * This function is used to transfer ASA
  * from one account to another using fromAccount secret key (for signing)

  * Returns:
  * Transaction details
*/

export async function transferAsset (
  deployer: AlgobDeployer,
  assetId: number,
  from: AccountSDK,
  to: string,
  amount: number
): Promise<tx.ConfirmedTxInfo> {
  const params = await deployer.algodClient.getTransactionParams().do();

  const sender = from;
  const recipient = to;
  const revocationTarget = undefined;
  const closeRemainderTo = undefined;
  const note = undefined;

  const xtxn = tx.makeAssetTransferTxnWithSuggestedParams(
    sender.addr,
    recipient,
    closeRemainderTo,
    revocationTarget,
    amount,
    note,
    assetId,
    params);

  const rawSignedTxn = xtxn.signTxn(sender.sk);
  const xtx = (await deployer.algodClient.sendRawTransaction(rawSignedTxn).do());
  console.log("Transferring:", {
    from: sender.addr,
    to: recipient,
    amount: amount,
    assetID: assetId,
    txId: xtx.txId
  });
  return await deployer.waitForConfirmation(xtx.txId);
}

/**
 * Description:
 * This function is used to transfer Algos
 * from one account to another using logic signature (for signing)

 * Returns:
 * Transaction details
*/

export async function transferMicroAlgosLsig (
  deployer: AlgobDeployer,
  fromAccount: Account,
  toAccountAddr: string,
  amountMicroAlgos: number,
  lsig: LogicSig,
  payFlags: TxParams): Promise<tx.ConfirmedTxInfo> {
  const params = await mkSuggestedParams(deployer.algodClient, payFlags);

  const receiver = toAccountAddr;
  const note = encodeNote(payFlags.note, payFlags.noteb64);

  const txn = tx.makePaymentTxnWithSuggestedParams(
    fromAccount.addr, receiver, amountMicroAlgos, payFlags.closeRemainderTo, note, params);

  const signedTxn = tx.signLogicSigTransactionObject(txn, lsig);
  const txId = txn.txID().toString();
  console.log(txId);
  const pendingTx = await deployer.algodClient.sendRawTransaction(signedTxn.blob).do();
  console.log("Transferring algo (in micro algos):", {
    from: fromAccount.addr,
    to: receiver,
    amount: amountMicroAlgos,
    txid: pendingTx.txId
  });
  return await deployer.waitForConfirmation(pendingTx.txId);
}

/**
 * Description:
 * This function is used to transfer Algorand Standard Assets (ASA)
 * from one account to another using logic signature (for signing)

 * Returns:
 * Transaction details
*/

export async function transferASALsig (
  deployer: AlgobDeployer,
  fromAccount: AccountSDK,
  toAccount: string,
  amountMicroAlgos: number,
  assetID: number,
  lsig: LogicSig): Promise<tx.ConfirmedTxInfo> {
  const params = await deployer.algodClient.getTransactionParams().do();
  const xtxn = tx.makeAssetTransferTxnWithSuggestedParams(
    fromAccount.addr,
    toAccount,
    undefined,
    undefined,
    amountMicroAlgos,
    undefined,
    assetID,
    params);

  const rawSignedTxn = tx.signLogicSigTransactionObject(xtxn, lsig);

  // send raw LogicSigTransaction to network
  const tx1 = (await deployer.algodClient.sendRawTransaction(rawSignedTxn.blob).do());

  return await deployer.waitForConfirmation(tx1.txId);
}
