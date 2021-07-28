import { types as rtypes } from "@algo-builder/runtime";
import { tx as webTx, types as wtypes } from "@algo-builder/web";
import algosdk, { Algodv2, decodeSignedTransaction, SuggestedParams, Transaction } from "algosdk";

import { ConfirmedTxInfo, Deployer } from "../types";
import { ALGORAND_MIN_TX_FEE } from "./algo-operator";
import { loadEncodedTxFromFile } from "./files";
import { registerCheckpoints } from "./script-checkpoints";

/**
 * Returns true if encoded transaction (fetched from file) is already signed
 * @param encodedTx msgpack encoded transaction */
export function isSignedTx (encodedTx: Uint8Array): boolean {
  try {
    decodeSignedTransaction(encodedTx);
  } catch (error) {
    return false;
  }
  return true;
}

/**
 * Returns blockchain transaction suggested parameters (firstRound, lastRound, fee..)
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
  algocl: Algodv2, userParams: wtypes.TxParams, s?: SuggestedParams): Promise<SuggestedParams> {
  if (s === undefined) { s = await getSuggestedParams(algocl); }

  if (userParams.flatFee === undefined) {
    if (userParams.totalFee !== undefined) s.flatFee = true;
    else s.flatFee = false;
  }
  s.fee = userParams.totalFee ?? userParams.feePerByte ?? ALGORAND_MIN_TX_FEE;

  s.firstRound = userParams.firstValid ?? s.firstRound;
  s.lastRound = userParams.firstValid === undefined || userParams.validRounds === undefined
    ? s.lastRound
    : Number(userParams.firstValid) + Number(userParams.validRounds);
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
  name: string, asaDef: wtypes.ASADef,
  flags: rtypes.ASADeploymentFlags, txSuggestedParams: SuggestedParams
): Transaction {
  // If TxParams has noteb64 or note , it gets precedence
  let note;
  if (flags.noteb64 ?? flags.note) {
    // TxParams note
    note = webTx.encodeNote(flags.note, flags.noteb64);
  } else if (asaDef.noteb64 ?? asaDef.note) {
    // ASA definition note
    note = webTx.encodeNote(asaDef.note, asaDef.noteb64);
  }

  // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
  return algosdk.makeAssetCreateTxnWithSuggestedParams(
    flags.creator.addr,
    note,
    BigInt(asaDef.total),
    Number(asaDef.decimals),
    asaDef.defaultFrozen ? asaDef.defaultFrozen : false,
    asaDef.manager !== "" ? asaDef.manager : undefined,
    asaDef.reserve !== "" ? asaDef.reserve : undefined,
    asaDef.freeze !== "" ? asaDef.freeze : undefined,
    asaDef.clawback !== "" ? asaDef.clawback : undefined,
    asaDef.unitName,
    name,
    asaDef.url ?? "",
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
  params: SuggestedParams,
  payFlags: wtypes.TxParams
): Transaction {
  const execParam: wtypes.ExecParams = {
    type: wtypes.TransactionType.OptInASA,
    sign: wtypes.SignType.SecretKey,
    fromAccount: { addr: addr, sk: new Uint8Array(0) },
    assetID: assetID,
    payFlags: payFlags
  };
  return webTx.mkTransaction(execParam, params);
}

/**
 * Returns signed transaction
 * @param txn unsigned transaction
 * @param execParams transaction execution parametrs
 */
function signTransaction (txn: Transaction, execParams: wtypes.ExecParams): Uint8Array {
  switch (execParams.sign) {
    case wtypes.SignType.SecretKey: {
      return txn.signTxn(execParams.fromAccount.sk);
    }
    case wtypes.SignType.LogicSignature: {
      execParams.lsig.args = execParams.args ?? [];
      return algosdk.signLogicSigTransactionObject(txn, execParams.lsig).blob;
    }
    default: {
      throw new Error("Unknown type of signature");
    }
  }
}

/**
 * Make transaction parameters and update deployASA, deployApp & ModifyAsset params
 * @param deployer Deployer object
 * @param txn Execution parameters
 * @param index index of current execParam
 * @param txIdxMap Map for index to name
 */
/* eslint-disable sonarjs/cognitive-complexity */
async function mkTx (
  deployer: Deployer,
  txn: wtypes.ExecParams,
  index: number,
  txIdxMap: Map<number, [string, wtypes.ASADef]>
): Promise<Transaction> {
  // if execParams for ASA related transaction have assetID as asaName,
  // then set to assetIndex using info from checkpoint
  switch (txn.type) {
    case wtypes.TransactionType.OptInASA :
    case wtypes.TransactionType.TransferAsset :
    case wtypes.TransactionType.ModifyAsset :
    case wtypes.TransactionType.FreezeAsset :
    case wtypes.TransactionType.RevokeAsset : {
      if (typeof txn.assetID === "string") {
        const asaInfo = deployer.getASAInfo(txn.assetID);
        txn.assetID = asaInfo.assetIndex;
      }
      break;
    }
    case wtypes.TransactionType.DestroyAsset : {
      if (typeof txn.assetID === "string") {
        txIdxMap.set(index, [txn.assetID, deployer.getASADef(txn.assetID, {})]);
        const asaInfo = deployer.getASAInfo(txn.assetID);
        txn.assetID = asaInfo.assetIndex;
      }
      break;
    }
  }

  switch (txn.type) {
    case wtypes.TransactionType.DeployASA: {
      deployer.assertNoAsset(txn.asaName);
      const asaDef = deployer.getASADef(txn.asaName, txn.asaDef);
      txn.asaDef = asaDef;
      if (txn.asaDef) txIdxMap.set(index, [txn.asaName, asaDef]);
      break;
    }
    case wtypes.TransactionType.DeployApp: {
      const name = String(txn.approvalProgram) + "-" + String(txn.clearProgram);
      deployer.assertNoAsset(name);
      const approval = await deployer.ensureCompiled(txn.approvalProgram);
      const clear = await deployer.ensureCompiled(txn.clearProgram);
      txn.approvalProg = new Uint8Array(Buffer.from(approval.compiled, "base64"));
      txn.clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));
      txIdxMap.set(index, [name, { total: 1, decimals: 1, unitName: "MOCK", defaultFrozen: false }]);
      break;
    }
    case wtypes.TransactionType.UpdateApp: {
      const cpKey = String(txn.newApprovalProgram) + "-" + String(txn.newClearProgram);
      const approval = await deployer.ensureCompiled(txn.newApprovalProgram);
      const clear = await deployer.ensureCompiled(txn.newClearProgram);
      txn.approvalProg = new Uint8Array(Buffer.from(approval.compiled, "base64"));
      txn.clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));
      txIdxMap.set(index, [cpKey, { total: 1, decimals: 1, unitName: "MOCK", defaultFrozen: false }]);
      break;
    }
    case wtypes.TransactionType.ModifyAsset: {
      // fetch asset mutable properties from network and set them (if they are not passed)
      // before modifying asset
      const assetInfo = await deployer.getAssetByID(BigInt(txn.assetID));
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
  return webTx.mkTransaction(txn,
    await mkTxParams(deployer.algodClient, txn.payFlags, Object.assign({}, suggestedParams)));
}

/**
 * Execute single transaction or group of transactions (atomic transaction)
 * @param deployer Deployer
 * @param execParams transaction parameters or atomic transaction parameters
 * https://github.com/scale-it/algo-builder/blob/docs/docs/guide/execute-transaction.md
 */
export async function executeTransaction (
  deployer: Deployer,
  execParams: wtypes.ExecParams | wtypes.ExecParams[]):
  Promise<ConfirmedTxInfo> {
  deployer.assertCPNotDeleted(execParams);
  try {
    let signedTxn;
    let txns: Transaction[] = [];
    const txIdxMap = new Map<number, [string, wtypes.ASADef]>();
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
    const confirmedTx = await deployer.sendAndWait(signedTxn);
    console.log(confirmedTx);
    if (deployer.isDeployMode) { await registerCheckpoints(deployer, txns, txIdxMap); }
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
  fileName: string): Promise<ConfirmedTxInfo> {
  const signedTxn = loadEncodedTxFromFile(fileName);
  if (signedTxn === undefined) { throw new Error(`File ${fileName} does not exist`); }

  console.debug("Decoded txn from %s: %O", fileName, algosdk.decodeSignedTransaction(signedTxn));
  const confirmedTx = await deployer.sendAndWait(signedTxn);
  console.log(confirmedTx);
  return confirmedTx;
}
