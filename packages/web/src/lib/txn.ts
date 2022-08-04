import { Txn } from "@randlabs/myalgo-connect";
import algosdk, { SignedTransaction, SuggestedParams, Transaction } from "algosdk";
import { ALGORAND_ZERO_ADDRESS_STRING } from "algosdk/dist/types/src/encoding/address";

import { types } from "..";
import { BuilderError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import {
	AccountAddress,
	AssetModFields,
	ExecParams,
	MetaType,
	SignType,
	TransactionType,
	TxParams,
} from "../types";
import { parseAppArgs } from "./parsing";

/**
 * Encodes note to bytes
 * When `note` is provided then uses the TexEncoder to convert note to bytes.
 * When `noteb64` is provided then uses base64 decoder to convert base64 text to bytes.
 * Throws an error if both `note` and `noteb64` are provided.
 * */
export function encodeNote(
	note: string | Uint8Array | undefined,
	noteb64: string | undefined
): Uint8Array | undefined {
	if (note === undefined && noteb64 === undefined) {
		return undefined;
	}
	if (noteb64 && note) {
		throw new BuilderError(ERRORS.ARGUMENTS.INVALID_TX_PARAM, {
			param: "note",
			error: "You can't define both note and noteb64 transaction option",
		});
	}
	if (noteb64) {
		return Buffer.from(noteb64, "base64");
	}
	if (note instanceof Uint8Array) return note;
	const encoder = new TextEncoder();
	return encoder.encode(note);
}

export function decodeText(bytes: Uint8Array | undefined): string | undefined {
	if (bytes === undefined) return undefined;
	return new TextDecoder().decode(bytes);
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
 * Returns revocation targer address from the Transaction object
 * @param transaction Transaction Object
 */
export function getTxRevokeAddress(transaction: Transaction): AccountAddress {
	if (transaction.assetRevocationTarget !== undefined) {
		return algosdk.encodeAddress(transaction.assetRevocationTarget.publicKey);
	} else {
		return "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
	}
}

/**
 * Returns from address from the Transaction object
 * @param transaction Transaction Object
 */
export function getTxFromAddress(transaction: Transaction): AccountAddress {
	return algosdk.encodeAddress(transaction.from.publicKey);
}

export function getAddress(account: algosdk.Address | undefined): AccountAddress | undefined {
	if (account !== undefined) {
		return algosdk.encodeAddress(account.publicKey);
	} else {
		return undefined;
	}
}

/**
 * Returns to address from the Transaction object
 * @param transaction Transaction Object
 */
export function getTxToAddress(transaction: Transaction): AccountAddress {
	return algosdk.encodeAddress(transaction.to.publicKey);
}

/**
 * Returns to address from the Transaction object
 * @param transaction Transaction Object
 */
export function getTxCloseReminderToAddress(
	transaction: Transaction
): AccountAddress | undefined {
	if (transaction.closeRemainderTo !== undefined) {
		return algosdk.encodeAddress(transaction.closeRemainderTo.publicKey);
	} else {
		return undefined;
	}
}

/**
 * Returns  reKeyTo address of the Transaction object
 * @param transaction Transaction Object
 */
export function getTxReKeyToToAddress(transaction: Transaction): AccountAddress | undefined {
	if (transaction.reKeyTo !== undefined) {
		return algosdk.encodeAddress(transaction.reKeyTo.publicKey);
	} else {
		return undefined;
	}
}

/**
 * Returns freeze target address of the Transaction object
 * @param transaction Transaction Object
 */
export function getTxFreezeAddress(transaction: Transaction): AccountAddress {
	if (transaction.freezeAccount !== undefined) {
		return algosdk.encodeAddress(transaction.freezeAccount.publicKey);
	} else {
		return "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
	}
}

/**
 * Returns ASA definiton
 * @param transaction Transaction Object
 */
export function getTxASADefinition(transaction: Transaction): types.ASADef {
	const asaDef: types.ASADef = {
		clawback: getAddress(transaction.assetClawback),
		manager: getAddress(transaction.assetManager),
		reserve: getAddress(transaction.assetReserve),
		freeze: getAddress(transaction.assetFreeze),
		name: transaction.assetName,
		total: transaction.assetTotal,
		decimals: transaction.assetDecimals,
		defaultFrozen: transaction.assetDefaultFrozen,
		unitName: transaction.assetUnitName,
		url: transaction.assetURL,
		metadataHash: transaction.assetMetadataHash
			? new TextDecoder().decode(transaction.assetMetadataHash)
			: undefined,
		note: undefined,
	};
	return asaDef;
}

/**
 * Returns to address from the Transaction object
 * @param transaction Transaction Object
 */
export function getTxFlags(transaction: Transaction): types.TxParams {
	const transactionFlags: types.TxParams = {};
	transactionFlags.closeRemainderTo = getTxCloseReminderToAddress(transaction);
	transactionFlags.lease = transaction.lease;
	transactionFlags.note = decodeText(transaction.note);
	transactionFlags.rekeyTo = getTxReKeyToToAddress(transaction);
	transactionFlags.firstValid = transaction.firstRound;
	transactionFlags.validRounds = transaction.lastRound - transaction.firstRound;
	if (transaction.flatFee === true) {
		transactionFlags.totalFee = transaction.fee;
		transactionFlags.flatFee = true;
	} else {
		transactionFlags.feePerByte = transaction.fee;
	}
	return transactionFlags;
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
 * Converts ExecParams to Algo SDK Transaction.
 * ExecParams is a type safe and more friendly way to create Algorand transactions.
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
					execParams.asaDef.manager !== "" ? execParams.asaDef.manager : undefined,
					execParams.asaDef.reserve !== "" ? execParams.asaDef.reserve : undefined,
					execParams.asaDef.freeze !== "" ? execParams.asaDef.freeze : undefined,
					execParams.asaDef.clawback !== "" ? execParams.asaDef.clawback : undefined,
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
					appDef.approvalProgramBytes,
					appDef.clearProgramBytes,
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
				// we can't compile a source code nor access local files (as we do in algob) in the web mode.
				throw new Error(
					"Only MetaType.BYTES is supported for deploying apps in the web mode. Provided mode: " +
						appDef.metaType
				);
			}
		}
		case TransactionType.UpdateApp: {
			if (execParams.newAppCode.metaType === MetaType.BYTES) {
				const tx = algosdk.makeApplicationUpdateTxn(
					fromAccountAddr,
					suggestedParams,
					execParams.appID,
					execParams.newAppCode.approvalProgramBytes,
					execParams.newAppCode.clearProgramBytes,
					parseAppArgs(execParams.appArgs),
					execParams.accounts,
					execParams.foreignApps,
					execParams.foreignAssets,
					note,
					execParams.lease,
					execParams.payFlags.rekeyTo
				);
				return updateTxFee(execParams.payFlags, tx);
			} else {
				// we can't compile a source code nor access local files (as we do in algob) in the web mode.
				throw new Error(
					"Only MetaType.BYTES is supported for deploying apps in the web mode. Provided mode: " +
						execParams.newAppCode.metaType
				);
			}
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

/**
 * Returns the fields necessary for an Asset Modification
 * @param transaction Transaction Object
 */
export function getAssetReconfigureFields(transaction: Transaction): AssetModFields {
	const modificationFields: AssetModFields = {};
	const encodedTransaction = transaction.get_obj_for_encoding();
	if (encodedTransaction.apar !== undefined) {
		modificationFields.clawback =
			encodedTransaction.apar.c !== undefined
				? algosdk.encodeAddress(transaction.assetClawback.publicKey)
				: "";
		modificationFields.freeze =
			encodedTransaction.apar.f !== undefined
				? algosdk.encodeAddress(transaction.assetFreeze.publicKey)
				: "";
		modificationFields.manager =
			encodedTransaction.apar.m !== undefined
				? algosdk.encodeAddress(transaction.assetManager.publicKey)
				: "";
		modificationFields.reserve =
			encodedTransaction.apar.r !== undefined
				? algosdk.encodeAddress(transaction.assetReserve.publicKey)
				: "";
	}
	return modificationFields;
}
