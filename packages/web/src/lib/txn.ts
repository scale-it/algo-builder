import algosdk, { SuggestedParams, Transaction } from 'algosdk';

import { BuilderError } from '../errors/errors';
import { ERRORS } from '../errors/errors-list';
import { AccountAddress, ExecParams, SignType, TransactionType, TxParams } from "../types";
import { parseAppArgs } from "./parsing";

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
    return execParams.fromAccountAddr || execParams.fromAccount.addr; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
  }
  return execParams.fromAccountAddr;
}

/**
 * Using flatFee, if flatFee is true, set totalFee
 * https://developer.algorand.org/tutorials/setting-transaction-fee-javascript/
 * @param params Transaction parameters
 * @param tx SDK Transaction object
 */
export function updateFee (params: TxParams, tx: Transaction): Transaction {
  if (params.flatFee && params.totalFee !== undefined) {
    tx.fee = params.totalFee;
  }
  return tx;
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
 *  + Deploy Params - deploy ASA, deploy App
 *  + OptIn Params - optInToASA, optInToApp
 *  + AppCallsParam (NoOp, Clear, Delete..)used for calling stateful smart contracts.
 For more advanced use-cases, please use `algosdk.tx` directly.
 NOTE: parseAppArgs is used to handle case when user passes appArgs similar to goal
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
      const tx = algosdk.makeAssetTransferTxnWithSuggestedParams(
        fromAccountAddr,
        execParams.toAccountAddr,
        execParams.payFlags.closeRemainderTo,
        undefined,
        execParams.amount,
        note,
        execParams.assetID,
        suggestedParams);
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.ModifyAsset: {
      const tx = algosdk.makeAssetConfigTxnWithSuggestedParams(
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
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.FreezeAsset: {
      const tx = algosdk.makeAssetFreezeTxnWithSuggestedParams(
        fromAccountAddr,
        encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64),
        execParams.assetID,
        execParams.freezeTarget,
        execParams.freezeState,
        suggestedParams
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.RevokeAsset: {
      const tx = algosdk.makeAssetTransferTxnWithSuggestedParams(
        fromAccountAddr,
        execParams.recipient,
        execParams.payFlags.closeRemainderTo,
        execParams.revocationTarget,
        execParams.amount,
        encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64),
        execParams.assetID,
        suggestedParams
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.DestroyAsset: {
      const tx = algosdk.makeAssetDestroyTxnWithSuggestedParams(
        fromAccountAddr,
        encodeNote(execParams.payFlags.note, execParams.payFlags.noteb64),
        execParams.assetID,
        suggestedParams
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.TransferAlgo: {
      const tx = algosdk.makePaymentTxnWithSuggestedParams(
        fromAccountAddr,
        execParams.toAccountAddr,
        execParams.amountMicroAlgos,
        execParams.payFlags.closeRemainderTo,
        note,
        suggestedParams,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.ClearApp: {
      const tx = algosdk.makeApplicationClearStateTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        parseAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.DeleteApp: {
      const tx = algosdk.makeApplicationDeleteTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        parseAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.CallNoOpSSC: {
      const tx = algosdk.makeApplicationNoOpTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        parseAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.CloseApp: {
      const tx = algosdk.makeApplicationCloseOutTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        parseAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.DeployASA: {
      if (execParams.asaDef) {
        // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
        const tx = algosdk.makeAssetCreateTxnWithSuggestedParams(
          fromAccountAddr,
          note,
          BigInt(execParams.asaDef.total || 0), // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
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
        return updateFee(execParams.payFlags, tx);
      } else {
        throw new BuilderError(
          ERRORS.GENERAL.PARAM_PARSE_ERROR, {
            reason: "ASA Definition not found",
            source: execParams.asaName
          });
      }
    }
    case TransactionType.DeployApp: {
      const onComplete = algosdk.OnApplicationComplete.NoOpOC;

      const tx = algosdk.makeApplicationCreateTxn(
        fromAccountAddr,
        suggestedParams,
        onComplete,
        execParams.approvalProg,
        execParams.clearProg,
        execParams.localInts,
        execParams.localBytes,
        execParams.globalInts,
        execParams.globalBytes,
        parseAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.UpdateApp: {
      const tx = algosdk.makeApplicationUpdateTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        execParams.approvalProg,
        execParams.clearProg,
        parseAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.OptInToApp: {
      const tx = algosdk.makeApplicationOptInTxn(
        fromAccountAddr,
        suggestedParams,
        execParams.appID,
        parseAppArgs(execParams.appArgs),
        execParams.accounts,
        execParams.foreignApps,
        execParams.foreignAssets,
        note,
        execParams.lease,
        execParams.payFlags.rekeyTo
      );
      return updateFee(execParams.payFlags, tx);
    }
    case TransactionType.OptInASA: {
      const tx = algosdk.makeAssetTransferTxnWithSuggestedParams(
        fromAccountAddr,
        fromAccountAddr,
        undefined,
        undefined,
        0,
        note,
        execParams.assetID,
        suggestedParams
      );
      return updateFee(execParams.payFlags, tx);
    }
    default: {
      throw new BuilderError(ERRORS.GENERAL.TRANSACTION_TYPE_ERROR,
        { transaction: transactionType });
    }
  }
}
