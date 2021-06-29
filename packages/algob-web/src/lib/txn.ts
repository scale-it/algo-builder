import algosdk, { Transaction, SuggestedParams } from 'algosdk';
import { AlgobWebError } from '../errors/algob-web-errors';
import { ALGOB_WEB_ERRORS } from '../errors/errors-list';

import { ExecParams, AccountAddress, SignType, TransactionType } from "../types";
import { parseSSCAppArgs } from "./parsing";

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
        execParams.appID,
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
        execParams.appID,
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
        execParams.appID,
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
        execParams.appID,
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
          BigInt(execParams.asaDef.total ?? 0),
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
        throw new AlgobWebError(
          ALGOB_WEB_ERRORS.ASA.PARAM_PARSE_ERROR, {
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
      throw new AlgobWebError(ALGOB_WEB_ERRORS.TRANSACTION.TRANSACTION_TYPE_ERROR,
        { transaction: transactionType });
    }
  }
}