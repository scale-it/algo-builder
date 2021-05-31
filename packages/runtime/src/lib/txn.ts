import type { AssetDefEnc, SuggestedParams, Transaction } from "algosdk";
import algosdk from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Op } from "../interpreter/opcode";
import { TxFieldDefaults, TxnFields } from "../lib/constants";
import { parseSSCAppArgs, stringToBytes } from "../lib/parsing";
import { AccountAddress, ExecParams, SignType, StackElem, TransactionType, TxField, Txn, TxnType } from "../types";

const assetTxnFields = new Set([
  'ConfigAssetTotal',
  'ConfigAssetDecimals',
  'ConfigAssetDefaultFrozen',
  'ConfigAssetUnitName',
  'ConfigAssetName',
  'ConfigAssetURL',
  'ConfigAssetMetadataHash',
  'ConfigAssetManager',
  'ConfigAssetReserve',
  'ConfigAssetFreeze',
  'ConfigAssetClawback'
]);

// return default value of txField if undefined,
// otherwise return parsed data to interpreter
export function parseToStackElem (a: unknown, field: TxField): StackElem {
  if (Buffer.isBuffer(a)) {
    return new Uint8Array(a);
  }
  if (typeof a === "number" || typeof a === "bigint") {
    return BigInt(a);
  }
  if (typeof a === "string") {
    return stringToBytes(a);
  }

  return TxFieldDefaults[field];
}

/**
 * Description: returns specific transaction field value from tx object
 * @param txField: transaction field
 * @param tx Current transaction
 * @param txns Transaction group
 * @param tealVersion version of TEAL
 */
export function txnSpecbyField (txField: string, tx: Txn, gtxns: Txn[], tealVersion: number): StackElem {
  let result; // store raw result, parse and return

  // handle nested encoded obj (for AssetDef)
  if (assetTxnFields.has(txField)) {
    const s = TxnFields[tealVersion][txField];
    const assetMetaData = tx.apar;
    result = assetMetaData?.[s as keyof AssetDefEnc];
    return parseToStackElem(result, txField);
  }

  // handle other cases
  switch (txField) {
    case 'FirstValidTime': { // Causes program to fail; reserved for future use
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
    }
    case 'TypeEnum': {
      result = Number(TxnType[tx.type as keyof typeof TxnType]); // TxnType['pay']
      break;
    }
    case 'TxID': {
      return stringToBytes(tx.txID);
    }
    case 'GroupIndex': {
      result = gtxns.indexOf(tx);
      break;
    }
    case 'NumAppArgs': {
      const appArg = TxnFields[tealVersion].ApplicationArgs as keyof Txn;
      const appArgs = tx[appArg] as Buffer[];
      result = appArgs?.length;
      break;
    }
    case 'NumAccounts': {
      const appAcc = TxnFields[tealVersion].Accounts as keyof Txn;
      const appAccounts = tx[appAcc] as Buffer[];
      result = appAccounts?.length;
      break;
    }
    default: {
      const s = TxnFields[tealVersion][txField]; // eg: rcv = TxnFields["Receiver"]
      result = tx[s as keyof Txn]; // pk_buffer = tx['rcv']
    }
  }

  return parseToStackElem(result, txField);
}

/**
 * Returns specific transaction field value from array
 * of accounts or application args
 * @param tx current transaction
 * @param txField transaction field
 * @param idx array index
 * @param op Op object
 * @param tealVersion version of TEAL
 * @param line line number in TEAL file
 */
export function txAppArg (txField: TxField, tx: Txn, idx: number, op: Op,
  tealVersion: number, line: number): Uint8Array {
  const s = TxnFields[tealVersion][txField]; // 'apaa' or 'apat'
  const result = tx[s as keyof Txn] as Buffer[]; // array of pk buffers (accounts or appArgs)
  if (!result) { // handle defaults
    return TxFieldDefaults[txField];
  }

  if (txField === 'Accounts') {
    if (idx === 0) { return parseToStackElem(tx.snd, txField) as Uint8Array; }
    idx--; // if not sender, then reduce index by 1
  }
  op.checkIndexBound(idx, result, line);
  return parseToStackElem(result[idx], txField) as Uint8Array;
}

export function encodeNote (note: string | undefined, noteb64: string| undefined): Uint8Array | undefined {
  if (note === undefined && noteb64 === undefined) { return undefined; }
  const encoder = new TextEncoder();
  return noteb64 ? encoder.encode(noteb64) : encoder.encode(note);
}

/**
 * Returns from address from the transaction params depending on @SignType
 * @param execParams transaction execution params passed by user
 */
export function getFromAddress (execParams: ExecParams): AccountAddress {
  if (execParams.sign === SignType.SecretKey) {
    return execParams.fromAccountAddr ?? execParams.fromAccount.addr;
  }
  return execParams.fromAccountAddr;
}

/**
 * Returns unsigned transaction as per ExecParams
 * ExecParams can be of following types:
 *  + AlgoTransferParam used for transferring algo
 *  + AssetTransferParam used for transferring asset
 *  + ModifyAssetParam used to modify asset mutable properties
 *  + FreezeAssetParam used to freeze asset (only permitted by asa freeze account)
 *  + RevokeAssetParam used to revoke assets (by asset clawback)
 *  + DestroyAssetParam used to delete asset (by asset manager)
 *  + Deploy Params - deploy ASA, deploy SSC
 *  + OptIn Params - optInToASA, optInToSSC
 *  + SSCCallsParam (NoOp, Clear, Delete..)used for calling stateful smart contracts.
 For more advanced use-cases, please use `algosdk.tx` directly.
 NOTE: parseSSCAppArgs is used to handle case when user passes appArgs similar to goal
 * @param execParams ExecParams
 * @param suggestedParams blockchain transaction suggested parameters (firstRound, lastRound, fee..)
 * @returns SDK Transaction object
 */
export function mkTransaction (execParams: ExecParams, suggestedParams: SuggestedParams): Transaction {
  const note = encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64);
  const transactionType = execParams.type;
  const fromAccountAddr = getFromAddress(execParams);
  switch (execParams.type) {
    case TransactionType.TransferAsset: {
      return algosdk.makeAssetTransferTxnWithSuggestedParams(
        fromAccountAddr,
        execParams.toAccountAddr,
        execParams.payFlags.closeRemainderTo,
        undefined,
        execParams.amount,
        note,
        execParams.assetID,
        suggestedParams);
    }
    case TransactionType.ModifyAsset: {
      return algosdk.makeAssetConfigTxnWithSuggestedParams(
        fromAccountAddr,
        encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64),
        execParams.assetID,
        execParams.fields.manager !== "" ? execParams.fields.manager : undefined,
        execParams.fields.reserve !== "" ? execParams.fields.reserve : undefined,
        execParams.fields.freeze !== "" ? execParams.fields.freeze : undefined,
        execParams.fields.clawback !== "" ? execParams.fields.clawback : undefined,
        suggestedParams,
        false
      );
    }
    case TransactionType.FreezeAsset: {
      return algosdk.makeAssetFreezeTxnWithSuggestedParams(
        fromAccountAddr,
        encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64),
        execParams.assetID,
        execParams.freezeTarget,
        execParams.freezeState,
        suggestedParams
      );
    }
    case TransactionType.RevokeAsset: {
      return algosdk.makeAssetTransferTxnWithSuggestedParams(
        fromAccountAddr,
        execParams.recipient,
        execParams.payFlags.closeRemainderTo,
        execParams.revocationTarget,
        execParams.amount,
        encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64),
        execParams.assetID,
        suggestedParams
      );
    }
    case TransactionType.DestroyAsset: {
      return algosdk.makeAssetDestroyTxnWithSuggestedParams(
        fromAccountAddr,
        encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64),
        execParams.assetID,
        suggestedParams
      );
    }
    case TransactionType.TransferAlgo: {
      return algosdk.makePaymentTxnWithSuggestedParams(
        fromAccountAddr,
        execParams.toAccountAddr,
        execParams.amountMicroAlgos,
        execParams.payFlags.closeRemainderTo,
        note,
        suggestedParams,
        execParams.payFlags.rekeyTo);
    }
    case TransactionType.ClearSSC: {
      return algosdk.makeApplicationClearStateTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appId,
        parseSSCAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
    }
    case TransactionType.DeleteSSC: {
      return algosdk.makeApplicationDeleteTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appId,
        parseSSCAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
    }
    case TransactionType.CallNoOpSSC: {
      return algosdk.makeApplicationNoOpTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appId,
        parseSSCAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo);
    }
    case TransactionType.CloseSSC: {
      return algosdk.makeApplicationCloseOutTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appId,
        parseSSCAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
    }
    case TransactionType.DeployASA: {
      if (execParams.asaDef) {
        // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
        return algosdk.makeAssetCreateTxnWithSuggestedParams(
          fromAccountAddr,
          note,
          BigInt(execParams.asaDef.total),
          execParams.asaDef.decimals,
          execParams.asaDef.defaultFrozen,
          execParams.asaDef.manager,
          execParams.asaDef.reserve,
          execParams.asaDef.freeze,
          execParams.asaDef.clawback,
          execParams.asaDef.unitName,
          execParams.asaName,
          execParams.asaDef.url,
          execParams.asaDef.metadataHash,
          suggestedParams
        );
      } else {
        throw new RuntimeError(
          RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR, {
            reason: "ASA Definition not found",
            source: execParams.asaName
          });
      }
    }
    case TransactionType.DeploySSC: {
      const onComplete = algosdk.OnApplicationComplete.NoOpOC;

      return algosdk.makeApplicationCreateTxn(
        fromAccountAddr,
        suggestedParams,
        onComplete,
        execParams.approvalProg,
        execParams.clearProg,
        execParams.localInts,
        execParams.localBytes,
        execParams.globalInts,
        execParams.globalBytes,
        parseSSCAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
    }
    case TransactionType.UpdateSSC: {
      return algosdk.makeApplicationUpdateTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        execParams.approvalProg,
        execParams.clearProg,
        parseSSCAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo);
    }
    case TransactionType.OptInSSC: {
      return algosdk.makeApplicationOptInTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        parseSSCAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo);
    }
    case TransactionType.OptInASA: {
      return algosdk.makeAssetTransferTxnWithSuggestedParams(
        fromAccountAddr,
        fromAccountAddr,
        undefined,
        undefined,
        0,
        note,
        execParams.assetID,
        suggestedParams
      );
    }
    default: {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.TRANSACTION_TYPE_ERROR,
        { transaction: transactionType });
    }
  }
}
