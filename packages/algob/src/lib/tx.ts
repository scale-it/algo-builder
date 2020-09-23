import type { Account as AccountSDK } from "algosdk";
import tx from "algosdk";
import { TextEncoder } from "util";

import { AlgobDeployerImpl } from "../internal/deployer";
import {
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

export function encodeNote (note: string | undefined, noteb64: string| undefined): Uint8Array {
  const encoder = new TextEncoder();
  return noteb64 ? encoder.encode(noteb64) : encoder.encode(note);
}

export async function transferMicroAlgos (
  deployer: AlgobDeployerImpl,
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

export async function transferAsset (
  deployer: AlgobDeployerImpl,
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
