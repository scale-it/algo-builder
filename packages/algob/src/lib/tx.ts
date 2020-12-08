import tx, { decodeSignedTransaction, SuggestedParams, Transaction } from "algosdk";
import { TextEncoder } from "util";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  AlgobDeployer,
  ASADef,
  ASADeploymentFlags,
  execParams,
  SignType,
  TransactionType,
  TxParams
} from "../types";
import { ALGORAND_MIN_TX_FEE } from "./algo-operator";
import { loadSignedTxnFromFile } from "./files";

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
 * Description: Returns unsigned transaction as per execParams
 * execParams can be of following types:
 * AlgoTransferParam used for transferring algo
 * AssetTransferParam used for transferring asset
 * SSCCallsParam used for calling stateful smart contracts.
 For more advanced use-cases, please use `algosdk.tx` directly.
 * @param deployer AlgobDeployer
 * @param txnParam execParam
 */
export function mkTransaction (txnParam: execParams, suggestedParams: SuggestedParams): Transaction {
  const note = encodeNote(txnParam.payFlags.note, txnParam.payFlags.noteb64);
  const transactionType = txnParam.type;
  switch (txnParam.type) {
    case TransactionType.TransferAsset: {
      return tx.makeAssetTransferTxnWithSuggestedParams(
        txnParam.fromAccount.addr,
        txnParam.toAccountAddr,
        txnParam.payFlags.closeRemainderTo,
        undefined,
        txnParam.amount,
        note,
        txnParam.assetID,
        suggestedParams);
    }
    case TransactionType.TransferAlgo: {
      return tx.makePaymentTxnWithSuggestedParams(
        txnParam.fromAccount.addr,
        txnParam.toAccountAddr,
        txnParam.amountMicroAlgos,
        txnParam.payFlags.closeRemainderTo,
        note,
        suggestedParams);
    }
    case TransactionType.ClearSSC: {
      return tx.makeApplicationClearStateTxn(
        txnParam.fromAccount.addr, suggestedParams, txnParam.appId, txnParam.appArgs);
    }
    case TransactionType.DeleteSSC: {
      return tx.makeApplicationDeleteTxn(
        txnParam.fromAccount.addr, suggestedParams, txnParam.appId, txnParam.appArgs);
    }
    case TransactionType.CallNoOpSSC: {
      return tx.makeApplicationNoOpTxn(
        txnParam.fromAccount.addr,
        suggestedParams,
        txnParam.appId,
        txnParam.appArgs,
        txnParam.accounts,
        txnParam.foreignApps,
        txnParam.foreignAssets,
        note,
        txnParam.lease,
        txnParam.rekeyTo);
    }
    case TransactionType.CloseSSC: {
      return tx.makeApplicationCloseOutTxn(
        txnParam.fromAccount.addr, suggestedParams, txnParam.appId, txnParam.appArgs);
    }
    default: {
      throw new BuilderError(ERRORS.GENERAL.TRANSACTION_TYPE_ERROR, { error: transactionType });
    }
  }
}

/**
 * Description: returns signed transaction
 * @param txn unsigned transaction
 * @param txnParam execParams
 */
function signTransaction (txn: Transaction, txnParam: execParams): Uint8Array {
  switch (txnParam.sign) {
    case SignType.SecretKey: {
      return txn.signTxn(txnParam.fromAccount.sk);
    }
    case SignType.LogicSignature: {
      const logicsig = txnParam.lsig;
      if (logicsig === undefined) {
        throw new Error("logic signature for this transaction was not passed or - is not defined");
      }
      return tx.signLogicSigTransactionObject(txn, logicsig).blob;
    }
    default: {
      throw new Error("Unknown type of signature");
    }
  }
}

/**
 * Description: send signed transaction to network and wait for confirmation
 * @param deployer AlgobDeployer
 * @param txns Signed Transaction(s)
 */
async function sendAndWait (
  deployer: AlgobDeployer,
  txns: Uint8Array | Uint8Array[]): Promise<tx.ConfirmedTxInfo> {
  const txInfo = await deployer.algodClient.sendRawTransaction(txns).do();
  return await deployer.waitForConfirmation(txInfo.txId);
}

export async function executeTransaction (
  deployer: AlgobDeployer,
  txnParams: execParams | execParams[]): Promise<tx.ConfirmedTxInfo> {
  if (Array.isArray(txnParams)) {
    if (txnParams.length > 16) {
      throw new Error("Maximum size of an atomic transfer group is 16");
    }

    const txns = [];
    for (const txnParam of txnParams) {
      const suggestedParams = await mkSuggestedParams(deployer.algodClient, txnParam.payFlags);
      const txn = mkTransaction(txnParam, suggestedParams);
      txns.push(txn);
    }
    tx.assignGroupID(txns);

    const signedTxns = [] as Uint8Array[];
    txns.forEach((txn, index) => {
      const signed = signTransaction(txn, txnParams[index]);
      deployer.log(`Transaction ${index}`, signed);
      signedTxns.push(signed);
    });
    const confirmedTx = await sendAndWait(deployer, signedTxns);
    console.log(confirmedTx);
    return confirmedTx;
  } else {
    const suggestedParams = await mkSuggestedParams(deployer.algodClient, txnParams.payFlags);
    const txn = mkTransaction(txnParams, suggestedParams);

    const signedTxn = signTransaction(txn, txnParams);
    const confirmedTx = await sendAndWait(deployer, signedTxn);
    console.log(confirmedTx);
    return confirmedTx;
  }
}

/**
 * Description: decode signed txn from file and send to network.
 * probably won't work, because transaction contains fields like
 * firstValid and lastValid which might not be equal to the
 * current network's blockchain block height.
 * @param deployer AlgobDeployer
 * @param fileName raw signed txn .tx file
 */
export async function executeSignedTxnFromFile (
  deployer: AlgobDeployer,
  fileName: string): Promise<tx.ConfirmedTxInfo> {
  const signedTxn = loadSignedTxnFromFile(fileName);
  if (signedTxn === undefined) {
    throw new Error(`File ${fileName} does not exist`);
  }
  console.debug("Decoded txn from %s: %O", fileName, decodeSignedTransaction(signedTxn));
  const confirmedTx = await sendAndWait(deployer, signedTxn);
  console.log(confirmedTx);
  return confirmedTx;
}
