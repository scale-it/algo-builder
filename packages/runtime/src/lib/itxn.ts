import algosdk, { decodeAddress, getApplicationAddress } from "algosdk";
import cloneDeep from "lodash.clonedeep";

import { Interpreter } from "..";
import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Op } from "../interpreter/opcode";
import {
	ALGORAND_MIN_TX_FEE,
	MaxTxnNoteBytes,
	TransactionTypeEnum,
	TxnFields,
} from "../lib/constants";
import { EncTx, StackElem } from "../types";
import { convertToString } from "./parsing";
import { assetTxnFields, calculateFeeCredit, CreditFeeType } from "./txn";

// supported types for inner tx (typeEnum -> type mapping)
// https://developer.algorand.org/docs/get-details/dapps/avm/teal/opcodes/#txn-f
const TxnTypeMap: { [key: string]: { version: number; field: string | number } } = {
	1: { version: 5, field: "pay" },
	2: { version: 6, field: "keyreg" },
	3: { version: 5, field: "acfg" }, // DeployASA OR RevokeAsset OR ModifyAsset OR DeleteAsset
	4: { version: 5, field: "axfer" }, // TransferAsset OR RevokeAsset,
	5: { version: 5, field: "afrz" },
	6: { version: 6, field: "appl" },
};

// each value here is number but they come in array
const arrayNumberFields = new Set(["Assets", "Applications"]);
// requires their type as number
const numberTxnFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set([
		"Fee",
		"FreezeAssetFrozen",
		"ConfigAssetDecimals",
		"ConfigAssetDefaultFrozen",
		...arrayNumberFields,
	]),
};
numberTxnFields[6] = cloneDeep(numberTxnFields[5]);
["VoteFirst", "VoteLast", "VoteKeyDilution", "Nonparticipation", "ApplicationID"].forEach(
	(field) => numberTxnFields[6].add(field)
);

const uintTxnFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set(["Amount", "AssetAmount", "TypeEnum", "ConfigAssetTotal"]),
};
uintTxnFields[6] = cloneDeep(uintTxnFields[5]);

// these are also uint values, but require that the asset
// be present in Txn.Assets[] array
const assetIDFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set(["XferAsset", "FreezeAsset", "ConfigAsset"]),
};

assetIDFields[6] = cloneDeep(assetIDFields[5]);

const byteTxnFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set(["ConfigAssetMetadataHash"]),
};

byteTxnFields[6] = cloneDeep(byteTxnFields[5]);
[
	"VotePK",
	"SelectionPK",
	"Note",
	"ApplicationArgs",
	"ApprovalProgram",
	"ClearStateProgram",
].forEach((field) => byteTxnFields[6].add(field));

const strTxnFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set(["Type", "ConfigAssetName", "ConfigAssetUnitName", "ConfigAssetURL"]),
};

strTxnFields[6] = cloneDeep(strTxnFields[5]);

const acfgAddrTxnFields: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set([
		"ConfigAssetManager",
		"ConfigAssetReserve",
		"ConfigAssetFreeze",
		"ConfigAssetClawback",
	]),
};

acfgAddrTxnFields[6] = cloneDeep(acfgAddrTxnFields[5]);

// each value here is Addr but they come in array
const arrayAddrFields = new Set(["Accounts"]);
const otherAddrTxnFields: { [key: number]: Set<string> } = {
	5: new Set([
		"Sender",
		"Receiver",
		"CloseRemainderTo",
		"AssetSender",
		"AssetCloseTo",
		"AssetReceiver",
		"FreezeAssetAccount",
		...arrayAddrFields,
	]),
};

otherAddrTxnFields[6] = cloneDeep(otherAddrTxnFields[5]);
// add new inner transaction fields support in teal v6.
["RekeyTo"].forEach((field) => otherAddrTxnFields[6].add(field));

const txTypes: { [key: number]: Set<string> } = {
	1: new Set(),
	2: new Set(),
	3: new Set(),
	4: new Set(),
	5: new Set(["pay", "axfer", "acfg", "afrz"]),
};

// supported keyreg on teal v6
txTypes[6] = cloneDeep(txTypes[5]);
txTypes[6].add("keyreg");
txTypes[6].add("appl");

/**
 * Sets inner transaction field to subTxn (eg. set assetReceiver('rcv'))
 * https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/#setting-transaction-properties
 */
/* eslint-disable sonarjs/cognitive-complexity */
export function setInnerTxField(
	subTxn: EncTx,
	field: string,
	val: StackElem,
	op: Op,
	interpreter: Interpreter,
	line: number
): EncTx {
	let txValue: bigint | number | string | Uint8Array | undefined;
	const tealVersion = interpreter.tealVersion;

	if (uintTxnFields[tealVersion].has(field)) {
		txValue = op.assertBigInt(val, line);
	}

	if (numberTxnFields[tealVersion].has(field)) {
		txValue = Number(op.assertBigInt(val, line));
	}

	if (assetIDFields[tealVersion].has(field)) {
		const id = op.assertBigInt(val, line);
		txValue = interpreter.getAssetIDByReference(Number(id), false, line, op);
	}

	if (strTxnFields[tealVersion].has(field)) {
		const assertedVal = op.assertBytes(val, line);
		txValue = convertToString(assertedVal);
	}

	if (byteTxnFields[tealVersion].has(field)) {
		txValue = op.assertBytes(val, line);
	}

	if (otherAddrTxnFields[tealVersion].has(field)) {
		const assertedVal = op.assertBytes(val, line);
		const accountState = interpreter.getAccount(assertedVal, line);
		txValue = Buffer.from(decodeAddress(accountState.address).publicKey);
	}

	// if address use for acfg we only check address is valid
	if (acfgAddrTxnFields[tealVersion].has(field)) {
		txValue = op.assertAlgorandAddress(val, line);
	}

	const encodedField = TxnFields[tealVersion][field]; // eg 'rcv'

	// txValue can be undefined for a field with not having TEALv5 support (eg. type 'appl')
	if (txValue === undefined) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.ITXN_FIELD_ERR, {
			msg: `Field ${field} is invalid`,
			field: field,
			line: line,
			tealV: tealVersion,
		});
	}

	// handle individual cases
	let errMsg = "";
	switch (field) {
		case "Type": {
			const txType = txValue as string;
			// check if txType is supported in current teal version
			if (!txTypes[tealVersion].has(txType)) {
				errMsg = `${txType} is not a valid Type for itxn_field`;
			}
			break;
		}
		case "TypeEnum": {
			const txType = op.assertBigInt(val, line);
			if (
				TxnTypeMap[Number(txType)] === undefined ||
				TxnTypeMap[Number(txType)].version > interpreter.tealVersion
			) {
				errMsg = `TypeEnum ${Number(txType)}does not support`;
			} else {
				subTxn.type = String(TxnTypeMap[Number(txType)].field);
			}
			break;
		}

		case "ConfigAssetDecimals": {
			const assetDecimals = txValue as bigint;
			if (assetDecimals > 19n || assetDecimals < 0n) {
				errMsg = "Decimals must be between 0 (non divisible) and 19";
			}
			break;
		}
		case "ConfigAssetMetadataHash": {
			const assetMetadataHash = txValue as Uint8Array;
			if (assetMetadataHash.length !== 32) {
				errMsg = "assetMetadataHash must be a 32 byte Uint8Array or string.";
			}
			break;
		}
		case "ConfigAssetUnitName": {
			const assetUnitName = txValue as string;
			if (assetUnitName.length > 8) {
				errMsg = "Unit name must not be longer than 8 bytes";
			}
			break;
		}
		case "ConfigAssetName": {
			const assetName = txValue as string;
			if (assetName.length > 32) {
				errMsg = "AssetName must not be longer than 8 bytes";
			}
			break;
		}
		case "ConfigAssetURL": {
			const assetURL = txValue as string;
			if (assetURL.length > 96) {
				errMsg = "URL must not be longer than 96 bytes";
			}
			break;
		}

		case "VotePK": {
			const votePk = txValue as Uint8Array;
			if (votePk.length !== 32) {
				errMsg = "VoteKey must be 32 bytes";
			}
			break;
		}

		case "SelectionPK": {
			const selectionPK = txValue as Uint8Array;
			if (selectionPK.length !== 32) {
				errMsg = "SelectionPK must be 32 bytes";
			}
			break;
		}

		case "Note": {
			const note = txValue as Uint8Array;
			if (note.length > MaxTxnNoteBytes) {
				errMsg = `Note must not be longer than ${MaxTxnNoteBytes} bytes`;
			}
			break;
		}
		default: {
			break;
		}
	}

	if (errMsg) {
		throw new RuntimeError(RUNTIME_ERRORS.TEAL.ITXN_FIELD_ERR, {
			msg: errMsg,
			field: field,
			line: line,
			tealV: tealVersion,
		});
	}

	// if everything goes well, set the [key, value]
	if (encodedField === null) {
		return subTxn; // could be for "TypeEnum"
	} else if (assetTxnFields.has(field)) {
		(subTxn as any).apar = (subTxn as any).apar ?? {};
		(subTxn as any).apar[encodedField] = txValue;
	} else {
		if (
			field === "ApplicationArgs" ||
			arrayNumberFields.has(field) ||
			arrayAddrFields.has(field)
		) {
			if ((subTxn as any)[encodedField] === undefined) {
				(subTxn as any)[encodedField] = [];
			}
			(subTxn as any)[encodedField].push(txValue);
		} else {
			(subTxn as any)[encodedField] = txValue;
		}
	}

	return subTxn;
}

/**
 * Calculate remaining fee after executing an inner transaction;
 * @param interpeter current interpeter contain context
 */
export function calculateInnerTxCredit(interpeter: Interpreter): CreditFeeType {
	// calculate curret txn group fee
	const feeInfo = calculateFeeCredit(interpeter.currentInnerTxnGroup);

	// plus fee from outner
	feeInfo.collectedFee += interpeter.runtime.ctx.remainingFee;
	feeInfo.remainingFee = feeInfo.collectedFee - feeInfo.requiredFee;

	return feeInfo;
}

// return 0 if transaction pay by pool fee
// return `ALGORAND_MIN_TX_FEE` if transaction pay by contract (pooled not enough fee).
export function getInnerTxDefaultFee(interpeter: Interpreter): number {
	// sum of outnerCredit.remaining and executedInnerCredit remaining
	const creditFee = calculateInnerTxCredit(interpeter).remainingFee;
	// if remaining fee is enough to pay current tx set default fee to zero
	// else set fee to ALGORAND_MIN_TX_FEE and contract will pay this transaction
	return creditFee >= ALGORAND_MIN_TX_FEE ? 0 : ALGORAND_MIN_TX_FEE;
}

/**
 * Add new inner tx to inner tx group
 * @param interpreter interpeter execute current tx
 * @param line line number
 * @returns EncTx object
 */
export function addInnerTransaction(interpreter: Interpreter, line: number): EncTx {
	// get app, assert it exists
	const appID = interpreter.runtime.ctx.tx.apid ?? 0;
	interpreter.runtime.assertAppDefined(appID, interpreter.getApp(appID, line), line);

	// get application's account
	const address = getApplicationAddress(appID);
	const applicationAccount = interpreter.runtime.assertAccountDefined(
		address,
		interpreter.runtime.ctx.state.accounts.get(address),
		line
	);

	return {
		// set sender, fee, fv, lv
		snd: Buffer.from(algosdk.decodeAddress(applicationAccount.address).publicKey),
		// user can change this fee
		fee: getInnerTxDefaultFee(interpreter),
		fv: interpreter.runtime.ctx.tx.fv,
		lv: interpreter.runtime.ctx.tx.lv,
		// to avoid type hack
		gen: interpreter.runtime.ctx.tx.gen,
		gh: interpreter.runtime.ctx.tx.gh,
		txID: "",
		type: TransactionTypeEnum.UNKNOWN,
	};
}
