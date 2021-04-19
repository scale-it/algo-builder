import { encodeNote, mkTransaction, types as rtypes } from "@algo-builder/runtime";
import { TransactionType } from "@algo-builder/runtime/build/types";
import algosdk, { Algodv2, encodeAddress, SuggestedParams, Transaction } from "algosdk";

import { ASAInfo, Deployer, SSCInfo } from "../types";
import { ALGORAND_MIN_TX_FEE } from "./algo-operator";
import { loadSignedTxnFromFile } from "./files";

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
      const logicsig = execParams.lsig;
      if (logicsig === undefined) {
        throw new Error("logic signature for this transaction was not passed or - is not defined");
      }
      return algosdk.signLogicSigTransactionObject(txn, logicsig).blob;
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
async function sendAndWait (
  deployer: Deployer,
  rawTxns: Uint8Array | Uint8Array[]): Promise<algosdk.ConfirmedTxInfo> {
  const txInfo = await deployer.algodClient.sendRawTransaction(rawTxns).do();
  return await deployer.waitForConfirmation(txInfo.txId);
}

/**
 * Make transaction parameters and update ASA and SSC params
 * @param deployer Deployer object
 * @param t Execution parameters
 * @param index index of current execParam
 * @param txIDMap Map for index to name
 */
async function mkTx (
  deployer: Deployer,
  t: rtypes.ExecParams,
  index: number,
  txIDMap: Map<number, string>
): Promise<Transaction> {
  switch (t.type) {
    case TransactionType.DeployASA: {
      deployer.assertNoAsset(t.asaName);
      t.asaDef = deployer.getASADef(t.asaName);
      txIDMap.set(index, t.asaName);
      break;
    }
    case TransactionType.DeploySSC: {
      const name = t.approvalProgram + "-" + t.clearProgram;
      deployer.assertNoAsset(name);
      const approval = await deployer.ensureCompiled(t.approvalProgram);
      const clear = await deployer.ensureCompiled(t.clearProgram);
      t.approvalProg = new Uint8Array(Buffer.from(approval.compiled, "base64"));
      t.clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));
      txIDMap.set(index, name);
      break;
    }
  }
  const suggestedParams = await getSuggestedParams(deployer.algodClient);
  return mkTransaction(t,
    await mkTxParams(deployer.algodClient, t.payFlags, Object.assign({}, suggestedParams)));
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
    const txIDMap = new Map<number, string>();
    if (Array.isArray(execParams)) {
      if (execParams.length > 16) { throw new Error("Maximum size of an atomic transfer group is 16"); }

      for (const [index, t] of execParams.entries()) {
        txns.push(await mkTx(deployer, t, index, txIDMap));
      }

      txns = algosdk.assignGroupID(txns);
      signedTxn = txns.map((txn: Transaction, index: number) => {
        const signed = signTransaction(txn, execParams[index]);
        deployer.log(`Signed transaction ${index}`, signed);
        return signed;
      });
    } else {
      const txn = await mkTx(deployer, execParams, 0, txIDMap);
      signedTxn = signTransaction(txn, execParams);
      deployer.log(`Signed transaction:`, signedTxn);
      txns = [txn];
    }
    const confirmedTx = await sendAndWait(deployer, signedTxn);
    console.log(confirmedTx);
    await registerCheckpoints(deployer, txns, txIDMap);
    return confirmedTx;
  } catch (error) {
    deployer.storeCheckpoint();

    console.log(error);
    throw error;
  }
}

/**
 * Register checkpoints for ASA and SSC
 * @param deployer Deployer object
 * @param txns transaction array
 * @param txIDMap transaction map index to name
 */
async function registerCheckpoints (
  deployer: Deployer,
  txns: Transaction[],
  txIDMap: Map<number, string>
): Promise<void> {
  for (const [i, txn] of txns.entries()) {
    let txConfirmation;
    const name = txIDMap.get(i);
    switch (txn.type) {
      case 'acfg': {
        txConfirmation = await deployer.waitForConfirmation(txn.txID());
        const asaInfo: ASAInfo = {
          creator: encodeAddress(txn.from.publicKey),
          txId: txn.txID(),
          assetIndex: txConfirmation["asset-index"],
          confirmedRound: txConfirmation['confirmed-round']
        };
        if (name) deployer.registerASAInfo(name, asaInfo);
        break;
      }
      case 'appl': {
        txConfirmation = await deployer.waitForConfirmation(txn.txID());
        const sscInfo: SSCInfo = {
          creator: encodeAddress(txn.from.publicKey),
          txId: txn.txID(),
          appID: txConfirmation['application-index'],
          confirmedRound: txConfirmation['confirmed-round']
        };
        if (name) deployer.registerSSCInfo(name, sscInfo);
        break;
      }
    }
  }
}

/**
 * Decode signed txn from file and send to network.
 * probably won't work, because transaction contains fields like
 * firstValid and lastValid which might not be equal to the
 * current network's blockchain block height.
 * @param deployer Deployer
 * @param fileName raw signed txn .tx file
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
