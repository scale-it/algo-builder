import type { Account, Account as AccountSDK, LogicSig } from "algosdk";
import tx from "algosdk";
import { TextEncoder } from "util";

import {
  AlgobDeployer,
  ASADef,
  ASADeploymentFlags,
  execParams,
  GrpTxnParams,
  TxParams
} from "../types";
import { ALGORAND_MIN_TX_FEE } from "./algo-operator";

const ALGO_MSG = "Transferring micro Algo:";

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
  console.log(ALGO_MSG, {
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
  console.log(ALGO_MSG, {
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

async function mkTransaction (deployer: AlgobDeployer, txnParam: execParams): Promise<any> {
  const params = await mkSuggestedParams(deployer.algodClient, txnParam.payFlags);
  const note = encodeNote(txnParam.payFlags.note, txnParam.payFlags.noteb64);

  switch (txnParam.type) {
    case "asset": {
      // rsolve undefined
      return tx.makeAssetTransferTxnWithSuggestedParams(
        txnParam.fromAccount.addr,
        txnParam.toAccountAddr,
        undefined,
        undefined,
        txnParam.amount,
        undefined,
        txnParam.assetID,
        params);
    }
    case "algo": {
      return tx.makePaymentTxnWithSuggestedParams(
        txnParam.fromAccount.addr,
        txnParam.toAccountAddr,
        txnParam.amountMicroAlgos,
        txnParam.payFlags.closeRemainderTo,
        note,
        params);
    }
    case "clearSSC": {
      return tx.makeApplicationClearStateTxn(txnParam.fromAccount.addr, params, txnParam.appId);
    }
    case "deleteSSC": {
      return tx.makeApplicationDeleteTxn(txnParam.fromAccount.addr, params, txnParam.appId);
    }
    case "callNoOpSSC": {
      return tx.makeApplicationNoOpTxn(
        txnParam.fromAccount.addr,
        params,
        txnParam.appId,
        txnParam.appArgs,
        txnParam.accounts,
        txnParam.foreignApps,
        txnParam.foreignAssets,
        note,
        txnParam.lease,
        txnParam.rekeyTo);
    }
    case "closeSSC": {
      return tx.makeApplicationCloseOutTxn(txnParam.fromAccount.addr, params, txnParam.appId);
    }
    default: {
      throw new Error("Unknown type of transaction");
    }
  }
}

function signTransaction (txn: any, txnParam: execParams): any {
  switch (txnParam.sign) {
    case "sk": {
      return txn.signTxn(txnParam.fromAccount.sk);
    }
    case "lsig": {
      const logicsig = txnParam.lsig;
      if (logicsig === undefined) {
        throw new Error("Lsig undefined");
      }
      return tx.signLogicSigTransactionObject(txn, logicsig);
    }
    default: {
      throw new Error("Unknown type of signature");
    }
  }
}

async function sendAndWait (deployer: AlgobDeployer, txns: any): Promise<tx.ConfirmedTxInfo> {
  const txInfo = (await deployer.algodClient.sendRawTransaction(txns).do());
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
      const txn = await mkTransaction(deployer, txnParam);
      txns.push(txn);
    }
    tx.assignGroupID(txns);

    const signedTxns = []; let idx = 0;
    for (const txn of txns) {
      signedTxns.push(signTransaction(txn, txnParams[idx]));
      idx++;
    }

    return await sendAndWait(deployer, signedTxns);
    // txwriter log
  } else {
    const txn = await mkTransaction(deployer, txnParams);
    const signedTxn = signTransaction(txn, txnParams);
    return await sendAndWait(deployer, signedTxn);
  }
}
/**
 * Description:
 * This function executes multiple transactions atomically where Algos are
 * transferred from one account to another using logic signature (for signing)

 * Returns:
 * ConfirmedTxInfo (transaction receipt)
*/
export async function transferMicroAlgosLsigAtomic (
  deployer: AlgobDeployer,
  grpTxnParams: GrpTxnParams[]
): Promise<tx.ConfirmedTxInfo> {
  if (grpTxnParams.length > 16) {
    throw new Error("Maximum size of an atomic transfer group is 16");
  }

  const txns = [];
  for (const p of grpTxnParams) {
    const params = await mkSuggestedParams(deployer.algodClient, p.payFlags);
    const receiver = p.toAccountAddr;
    const note = encodeNote(p.payFlags.note, p.payFlags.noteb64);

    const txn = tx.makePaymentTxnWithSuggestedParams(
      p.fromAccount.addr, receiver, p.amountMicroAlgos, p.payFlags.closeRemainderTo, note, params);

    txns.push(txn); // group transactions
  }

  tx.assignGroupID(txns); // assign common group hash to all transactions

  const signed = []; const logs = []; let idx = 0;
  for (const txn of txns) {
    const signedTxn = tx.signLogicSigTransactionObject(txn, grpTxnParams[idx].lsig);
    signed.push(signedTxn.blob);

    const txnInfo = {
      from: grpTxnParams[idx].fromAccount.addr,
      to: grpTxnParams[idx].toAccountAddr,
      amount: txn.amount,
      txid: signedTxn.txID
    };
    logs.push(txnInfo);
    idx++;
  }

  const pendingTx = await deployer.algodClient.sendRawTransaction(signed).do();
  console.log(ALGO_MSG, logs);
  return await deployer.waitForConfirmation(pendingTx.txId);
}
