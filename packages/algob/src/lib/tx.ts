import { encodeNote, mkTransaction, types as rtypes } from "@algo-builder/runtime";
import { AssetModFields, TransactionType, TxField } from "@algo-builder/runtime/build/types";
import algosdk, { Algodv2, SuggestedParams, Transaction } from "algosdk";

import { Deployer } from "../types";
import { ALGORAND_MIN_TX_FEE } from "./algo-operator";
import { loadSignedTxnFromFile } from "./files";
import { registerCheckpoints } from "./script-checkpoints";

/**
 * Returns blockchain transaction suggested parameters
 * @param algocl an Algorand client, instance of Algodv2, used to communicate with a blockchain node.
 */
export async function getSuggestedParams (algocl: Algodv2): Promise<SuggestedParams> {
  const params = await algocl.getTransactionParams().do();
  // Private chains may have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Suggested params returned 0 as firstRound. Ensure that your node progresses.");
    // params.firstRound = 1
  }
  return params;
}

/**
 * Returns a union object of custom transaction params and suggested params.
 * @param algocl an Algorand client, instance of Algodv2, used to communicate with a blockchain node.
 * @param userParams a dict containing custom params defined by the user
 * @param s suggested transaction params
 */
export async function mkTxParams (
  algocl: Algodv2, userParams: rtypes.TxParams, s?: SuggestedParams): Promise<SuggestedParams> {
  if (s === undefined) { s = await getSuggestedParams(algocl); }

  s.flatFee = userParams.totalFee !== undefined;
  s.fee = userParams.totalFee ?? userParams.feePerByte ?? ALGORAND_MIN_TX_FEE;
  if (s.flatFee) s.fee = Math.max(s.fee, ALGORAND_MIN_TX_FEE);

  s.firstRound = userParams.firstValid ?? s.firstRound;
  s.lastRound = userParams.firstValid === undefined || userParams.validRounds === undefined
    ? s.lastRound
    : userParams.firstValid + userParams.validRounds;
  return s;
}

/**
 * Returns SDK transaction object for ASA creation
 * @param name asset name
 * @param asaDef asset definition (passed in `/assets/asa.yaml)
 * @param flags basic transaction flags like `feePerByte`, `totalFee`, etc
 * @param txSuggestedParams suggested transaction params
 */
export function makeAssetCreateTxn (
  name: string, asaDef: rtypes.ASADef,
  flags: rtypes.ASADeploymentFlags, txSuggestedParams: SuggestedParams
): Transaction {
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
  return algosdk.makeAssetCreateTxnWithSuggestedParams(
    flags.creator.addr,
    note,
    BigInt(asaDef.total),
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

/**
 * Returns SDK transaction object for ASA Opt-In operation
 * @param addr the address of the user to be opted-in
 * @param assetID the unique asset ID for which the opt-in transaction will be performed
 * @param params suggested transaction params
 */
export function makeASAOptInTx (
  addr: string,
  assetID: number,
  params: SuggestedParams
): Transaction {
  const closeRemainderTo = undefined;
  const revocationTarget = undefined;
  const amount = 0;
  const note = undefined;
  return algosdk.makeAssetTransferTxnWithSuggestedParams(
    addr,
    addr,
    closeRemainderTo,
    revocationTarget,
    amount,
    note,
    assetID,
    params);
}

/**
 * Returns signed transaction
 * @param txn unsigned transaction
 * @param execParams transaction execution parametrs
 */
function signTransaction (txn: Transaction, execParams: rtypes.ExecParams): Uint8Array {
  switch (execParams.sign) {
    case rtypes.SignType.SecretKey: {
      return txn.signTxn(execParams.fromAccount.sk);
    }
    case rtypes.SignType.LogicSignature: {
      execParams.lsig.args = execParams.args ?? [];
      return algosdk.signLogicSigTransactionObject(txn, execParams.lsig).blob;
    }
    default: {
      throw new Error("Unknown type of signature");
    }
  }
}

/**
 * Send signed transaction to network and wait for confirmation
 * @param deployer Deployer
 * @param rawTxns Signed Transaction(s)
 */
export async function sendAndWait (
  deployer: Deployer,
  rawTxns: Uint8Array | Uint8Array[]): Promise<algosdk.ConfirmedTxInfo> {
  const txInfo = await deployer.algodClient.sendRawTransaction(rawTxns).do();
  return await deployer.waitForConfirmation(txInfo.txId);
}

/**
 * Make transaction parameters and update deployASA, deploySSC & ModifyAsset params
 * @param deployer Deployer object
 * @param txn Execution parameters
 * @param index index of current execParam
 * @param txIdxMap Map for index to name
 */
/* eslint-disable sonarjs/cognitive-complexity */
async function mkTx (
  deployer: Deployer,
  txn: rtypes.ExecParams,
  index: number,
  txIdxMap: Map<number, [string, rtypes.ASADef]>
): Promise<Transaction> {
  switch (txn.type) {
    case TransactionType.DeployASA: {
      deployer.assertNoAsset(txn.asaName);
      const asaDef = deployer.getASADef(txn.asaName, txn.asaDef);
      txn.asaDef = asaDef;
      if (txn.asaDef) txIdxMap.set(index, [txn.asaName, asaDef]);
      break;
    }
    case TransactionType.DeploySSC: {
      const name = txn.approvalProgram + "-" + txn.clearProgram;
      deployer.assertNoAsset(name);
      const approval = await deployer.ensureCompiled(txn.approvalProgram);
      const clear = await deployer.ensureCompiled(txn.clearProgram);
      txn.approvalProg = new Uint8Array(Buffer.from(approval.compiled, "base64"));
      txn.clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));
      txIdxMap.set(index, [name, { total: 1, decimals: 1, unitName: "MOCK" }]);
      break;
    }
    case TransactionType.UpdateSSC: {
      const name = txn.newApprovalProgram + "-" + txn.newClearProgram;
      deployer.assertNoAsset(name);
      const approval = await deployer.ensureCompiled(txn.newApprovalProgram);
      const clear = await deployer.ensureCompiled(txn.newClearProgram);
      txn.approvalProg = new Uint8Array(Buffer.from(approval.compiled, "base64"));
      txn.clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));
      txIdxMap.set(index, [name, { total: 1, decimals: 1, unitName: "MOCK" }]);
      break;
    }
    case TransactionType.ModifyAsset: {
      // fetch asset mutable properties from network and set them (if they are not passed)
      // before modifying asset
      const assetInfo = await deployer.getAssetByID(txn.assetID);
      if (txn.fields.manager === "") txn.fields.manager = undefined;
      else txn.fields.manager = txn.fields.manager ?? assetInfo.params.manager;

      if (txn.fields.freeze === "") txn.fields.freeze = undefined;
      else txn.fields.freeze = txn.fields.freeze ?? assetInfo.params.freeze;

      if (txn.fields.clawback === "") txn.fields.clawback = undefined;
      else txn.fields.clawback = txn.fields.clawback ?? assetInfo.params.clawback;

      if (txn.fields.reserve === "") txn.fields.reserve = undefined;
      else txn.fields.reserve = txn.fields.reserve ?? assetInfo.params.reserve;

      break;
    }
  }

  const suggestedParams = await getSuggestedParams(deployer.algodClient);
  return mkTransaction(txn,
    await mkTxParams(deployer.algodClient, txn.payFlags, Object.assign({}, suggestedParams)));
}

/**
 * Execute single transactions or group of transactions (atomic transaction)
 * @param deployer Deployer
 * @param execParams transaction parameters or atomic transaction parameters
 */
export async function executeTransaction (
  deployer: Deployer,
  execParams: rtypes.ExecParams | rtypes.ExecParams[]): Promise<algosdk.ConfirmedTxInfo> {
  try {
    let signedTxn;
    let txns: Transaction[] = [];
    const txIdxMap = new Map<number, [string, rtypes.ASADef]>();
    if (Array.isArray(execParams)) {
      if (execParams.length > 16) { throw new Error("Maximum size of an atomic transfer group is 16"); }

      for (const [idx, txn] of execParams.entries()) {
        txns.push(await mkTx(deployer, txn, idx, txIdxMap));
      }

      txns = algosdk.assignGroupID(txns);
      signedTxn = txns.map((txn: Transaction, index: number) => {
        const signed = signTransaction(txn, execParams[index]);
        deployer.log(`Signed transaction ${index}`, signed);
        return signed;
      });
    } else {
      const txn = await mkTx(deployer, execParams, 0, txIdxMap);
      signedTxn = signTransaction(txn, execParams);
      deployer.log(`Signed transaction:`, signedTxn);
      txns = [txn];
    }
    const confirmedTx = await sendAndWait(deployer, signedTxn);
    console.log(confirmedTx);
    await registerCheckpoints(deployer, txns, txIdxMap);
    return confirmedTx;
  } catch (error) {
    if (deployer.isDeployMode) { deployer.persistCP(); }

    throw error;
  }
}

/**
 * Decode signed txn from file and send to network.
 * probably won't work, because transaction contains fields like
 * firstValid and lastValid which might not be equal to the
 * current network's blockchain block height.
 * @param deployer Deployer
 * @param fileName raw(encoded) signed txn file
 */
export async function executeSignedTxnFromFile (
  deployer: Deployer,
  fileName: string): Promise<algosdk.ConfirmedTxInfo> {
  const signedTxn = loadSignedTxnFromFile(fileName);
  if (signedTxn === undefined) { throw new Error(`File ${fileName} does not exist`); }

  console.debug("Decoded txn from %s: %O", fileName, algosdk.decodeSignedTransaction(signedTxn));
  const confirmedTx = await sendAndWait(deployer, signedTxn);
  console.log(confirmedTx);
  return confirmedTx;
}
