import algosdk, { SuggestedParams, Transaction } from "algosdk";

import { BuilderError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import {
	AccountAddress,
	ExecParams,
	MetaType,
	SignType,
	TransactionType,
	TxParams,
} from "../types";
import { parseAppArgs } from "./parsing";

export function encodeNote(
	note: string | undefined,
	noteb64: string | undefined
): Uint8Array | undefined {
	if (note === undefined && noteb64 === undefined) {
		return undefined;
	}
	const encoder = new TextEncoder();
	return noteb64 ? encoder.encode(noteb64) : encoder.encode(note);
}

/**
 * Returns from address from the transaction params depending on @SignType
 * @param execParams transaction execution params passed by user
 */
export function getFromAddress(execParams: ExecParams): AccountAddress {
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
export function updateTxFee(params: TxParams, tx: Transaction): Transaction {
	if (params.totalFee !== undefined) {
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
/* eslint-disable sonarjs/cognitive-complexity */
export function mkTransaction(
	execParams: ExecParams,
	suggestedParams: SuggestedParams
): Transaction {
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
				execParams.assetID as number,
				suggestedParams,
				execParams.payFlags.rekeyTo
			);
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.ModifyAsset: {
			const tx = algosdk.makeAssetConfigTxnWithSuggestedParams(
				fromAccountAddr,
				note,
				execParams.assetID as number,
				execParams.fields.manager !== "" ? execParams.fields.manager : undefined,
				execParams.fields.reserve !== "" ? execParams.fields.reserve : undefined,
				execParams.fields.freeze !== "" ? execParams.fields.freeze : undefined,
				execParams.fields.clawback !== "" ? execParams.fields.clawback : undefined,
				suggestedParams,
				false,
				execParams.payFlags.rekeyTo
			);
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.FreezeAsset: {
			const tx = algosdk.makeAssetFreezeTxnWithSuggestedParams(
				fromAccountAddr,
				note,
				execParams.assetID as number,
				execParams.freezeTarget,
				execParams.freezeState,
				suggestedParams,
				execParams.payFlags.rekeyTo
			);
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.RevokeAsset: {
			const tx = algosdk.makeAssetTransferTxnWithSuggestedParams(
				fromAccountAddr,
				execParams.recipient,
				execParams.payFlags.closeRemainderTo,
				execParams.revocationTarget,
				execParams.amount,
				note,
				execParams.assetID as number,
				suggestedParams,
				execParams.payFlags.rekeyTo
			);
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.DestroyAsset: {
			const tx = algosdk.makeAssetDestroyTxnWithSuggestedParams(
				fromAccountAddr,
				note,
				execParams.assetID as number,
				suggestedParams,
				execParams.payFlags.rekeyTo
			);
			return updateTxFee(execParams.payFlags, tx);
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
			return updateTxFee(execParams.payFlags, tx);
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
			return updateTxFee(execParams.payFlags, tx);
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
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.CallApp: {
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
			return updateTxFee(execParams.payFlags, tx);
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
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.DeployASA: {
			if (execParams.asaDef) {
				// https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
				const tx = algosdk.makeAssetCreateTxnWithSuggestedParams(
					fromAccountAddr,
					note,
					BigInt(execParams.asaDef.total || 0), // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
					execParams.asaDef.decimals as number,
					execParams.asaDef.defaultFrozen ? execParams.asaDef.defaultFrozen : false,
					execParams.asaDef.manager,
					execParams.asaDef.reserve,
					execParams.asaDef.freeze,
					execParams.asaDef.clawback,
					execParams.asaDef.unitName,
					execParams.asaName,
					execParams.asaDef.url,
					execParams.asaDef.metadataHash,
					suggestedParams,
					execParams.payFlags.rekeyTo
				);
				return updateTxFee(execParams.payFlags, tx);
			} else {
				throw new BuilderError(ERRORS.GENERAL.PARAM_PARSE_ERROR, {
					reason: "ASA Definition not found",
					source: execParams.asaName,
				});
			}
		}
		case TransactionType.DeployApp: {
			const onComplete = algosdk.OnApplicationComplete.NoOpOC;
			const appDef = execParams.appDefinition;
			if (appDef.metaType === MetaType.BYTES) {
				const tx = algosdk.makeApplicationCreateTxn(
					fromAccountAddr,
					suggestedParams,
					onComplete,
					appDef.approvalProgram,
					appDef.clearProgram,
					appDef.localInts,
					appDef.localBytes,
					appDef.globalInts,
					appDef.globalBytes,
					parseAppArgs(appDef.appArgs),
					appDef.accounts,
					appDef.foreignApps,
					appDef.foreignAssets,
					note,
					appDef.lease,
					execParams.payFlags.rekeyTo,
					appDef.extraPages
				);
				return updateTxFee(execParams.payFlags, tx);
			} else {
				throw new Error("Not suppport"); // TODO: better message error
			}
		}
		case TransactionType.UpdateApp: {
			const tx = algosdk.makeApplicationUpdateTxn(
				fromAccountAddr,
				suggestedParams,
				execParams.appID,
				execParams.approvalProg ? execParams.approvalProg : new Uint8Array(8).fill(0),
				execParams.clearProg ? execParams.clearProg : new Uint8Array(8).fill(0),
				parseAppArgs(execParams.appArgs),
				execParams.accounts,
				execParams.foreignApps,
				execParams.foreignAssets,
				note,
				execParams.lease,
				execParams.payFlags.rekeyTo
			);
			return updateTxFee(execParams.payFlags, tx);
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
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.OptInASA: {
			const tx = algosdk.makeAssetTransferTxnWithSuggestedParams(
				fromAccountAddr,
				fromAccountAddr,
				undefined,
				undefined,
				0,
				note,
				execParams.assetID as number,
				suggestedParams,
				execParams.payFlags.rekeyTo
			);
			return updateTxFee(execParams.payFlags, tx);
		}
		case TransactionType.KeyRegistration: {
			const tx = algosdk.makeKeyRegistrationTxnWithSuggestedParams(
				fromAccountAddr,
				note,
				execParams.voteKey,
				execParams.selectionKey,
				execParams.voteFirst,
				execParams.voteLast,
				execParams.voteKeyDilution,
				suggestedParams,
				execParams.payFlags.rekeyTo,
				execParams.nonParticipation
			);
			return updateTxFee(execParams.payFlags, tx);
		}
		default: {
			throw new BuilderError(ERRORS.GENERAL.TRANSACTION_TYPE_ERROR, {
				transaction: transactionType,
			});
		}
	}
}
