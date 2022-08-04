import { parsing, types } from "@algo-builder/web";
import {
	encodeAddress,
	EncodedAssetParams,
	EncodedGlobalStateSchema,
	Transaction,
} from "algosdk";

import { Interpreter } from "..";
import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Op } from "../interpreter/opcode";
import { ITxn, ITxna } from "../interpreter/opcode-list";
import {
	ALGORAND_MIN_TX_FEE,
	TransactionTypeEnum,
	TxFieldDefaults,
	TxnFields,
	ZERO_ADDRESS,
	ZERO_ADDRESS_STR,
} from "../lib/constants";
import {
	AppInfo,
	ASAInfo,
	Context,
	EncTx,
	RuntimeAccountI,
	StackElem,
	TxField,
	TxnType,
} from "../types";
import { convertToString } from "./parsing";

export const assetTxnFields = new Set([
	"ConfigAssetTotal",
	"ConfigAssetDecimals",
	"ConfigAssetDefaultFrozen",
	"ConfigAssetUnitName",
	"ConfigAssetName",
	"ConfigAssetURL",
	"ConfigAssetMetadataHash",
	"ConfigAssetManager",
	"ConfigAssetReserve",
	"ConfigAssetFreeze",
	"ConfigAssetClawback",
]);

const globalAndLocalNumTxnFields = new Set([
	"GlobalNumUint",
	"GlobalNumByteSlice",
	"LocalNumUint",
	"LocalNumByteSlice",
]);

// return default value of txField if undefined,
// otherwise return parsed data to interpreter
export function parseToStackElem(a: unknown, field: TxField): StackElem {
	if (a instanceof Uint8Array) {
		return a;
	}

	if (Buffer.isBuffer(a)) {
		return new Uint8Array(a);
	}

	if (typeof a === "number" || typeof a === "bigint" || typeof a === "boolean") {
		return BigInt(a);
	}

	if (typeof a === "string") {
		return parsing.stringToBytes(a);
	}
	return TxFieldDefaults[field];
}

/**
 * Check if given transaction is asset deletion
 * @param txn EncTx Object
 * Logic:
 * https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction
 * https://github.com/algorand/js-algorand-sdk/blob/e07d99a2b6bd91c4c19704f107cfca398aeb9619/src/transaction.ts#L528
 */
export function checkIfAssetDeletionTx(txn: Transaction): boolean {
	return (
		String(txn.type) === TransactionTypeEnum.ASSET_CONFIG && // type should be asset config
		txn.assetIndex > 0 && // assetIndex should not be 0
		!(txn.assetClawback || txn.assetFreeze || txn.assetManager || txn.assetReserve)
	); // fields should be empty
}

/**
 * Description: returns specific transaction field value from tx object
 * @param txField: transaction field
 * @param tx Current transaction
 * @param gtxns Transaction group
 * @param interpreter interpreter object
 */
export function txnSpecByField(
	txField: string,
	tx: EncTx,
	gtxns: EncTx[],
	interpreter: Interpreter
): StackElem {
	let result; // store raw result, parse and return
	const tealVersion = interpreter.tealVersion;
	// handle nested encoded obj (for AssetDef, AppGlobalNumFields, AppLocalNumFields)
	if (assetTxnFields.has(txField)) {
		const s = TxnFields[tealVersion][txField];
		const assetMetaData = tx.apar;
		result = assetMetaData?.[s as keyof EncodedAssetParams];
		return parseToStackElem(result, txField);
	}
	if (globalAndLocalNumTxnFields.has(txField)) {
		const encAppGlobalSchema = txField.includes("Global") ? tx.apgs : tx.apls;
		const s = TxnFields[tealVersion][txField];
		result = encAppGlobalSchema?.[s as keyof EncodedGlobalStateSchema];
		return parseToStackElem(result, txField);
	}

	// handle other cases
	switch (txField) {
		case "FirstValidTime": {
			// Causes program to fail; reserved for future use
			throw new RuntimeError(RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
		}
		case "TypeEnum": {
			result = Number(TxnType[tx.type as keyof typeof TxnType]); // TxnType['pay']
			break;
		}
		case "TxID": {
			return parsing.stringToBytes(tx.txID);
		}
		case "GroupIndex": {
			result = gtxns.indexOf(tx);
			break;
		}
		case "NumAppArgs": {
			const appArg = TxnFields[tealVersion].ApplicationArgs as keyof EncTx;
			const appArgs = tx[appArg] as Buffer[];
			result = appArgs?.length;
			break;
		}
		case "NumAccounts": {
			const appAcc = TxnFields[tealVersion].Accounts as keyof EncTx;
			const appAccounts = tx[appAcc] as Buffer[];
			result = appAccounts?.length;
			break;
		}
		case "NumAssets": {
			const encAppAsset = TxnFields[tealVersion].Assets as keyof EncTx; // 'apas'
			const foreignAssetsArr = tx[encAppAsset] as Buffer[];
			result = foreignAssetsArr?.length;
			break;
		}
		case "NumApplications": {
			const encApp = TxnFields[tealVersion].Applications as keyof EncTx; // 'apfa'
			const foreignAppsArr = tx[encApp] as Buffer[];
			result = foreignAppsArr?.length;
			break;
		}
		case "AssetSender": {
			// if tx.asns is undefined we return zero address;
			if (tx.type === "axfer") {
				result = tx.asnd ?? Buffer.from(ZERO_ADDRESS);
			}
			break;
		}
		case "CreatedAssetID": {
			const asaInfo = interpreter.runtime.ctx.state.txReceipts.get(tx.txID) as ASAInfo;
			if (asaInfo !== undefined) result = BigInt(asaInfo.assetIndex);
			else result = 0n;
			break;
		}
		case "CreatedApplicationID": {
			const appInfo = interpreter.runtime.ctx.state.txReceipts.get(tx.txID) as AppInfo;
			if (appInfo.appID !== undefined) result = BigInt(appInfo.appID);
			else if (isEncTxApplicationCreate(tx))
				result = BigInt(interpreter.runtime.ctx.state.appCounter + 1);
			else result = 0n;
			break;
		}
		case "LastLog": {
			result = interpreter.runtime.ctx.lastLog;
			break;
		}

		case "StateProofPK": {
			// While running teal debugger, "StateProofPK" always return 64 zero bytes.
			// so we set up 64 zero bytes as default value of StateProofPK
			result = new Uint8Array(64).fill(0); // 64 zero bytes
			break;
		}

		default: {
			const s = TxnFields[tealVersion][txField]; // eg: rcv = TxnFields["Receiver"]
			result = tx[s as keyof EncTx]; // pk_buffer = tx['rcv']
		}
	}

	return parseToStackElem(result, txField);
}

/**
 * Returns specific transaction field value from array
 * of accounts or application args
 * @param tx current transaction
 * @param txField transaction field
 * @param idx index in EncodedTransaction[txField]
 * @param op Op object
 * @param interpreter interpreter object
 * @param line line number in TEAL file
 */
export function txAppArg(
	txField: TxField,
	tx: EncTx,
	idx: number,
	op: Op,
	interpreter: Interpreter,
	line: number
): StackElem {
	const tealVersion: number = interpreter.tealVersion;

	if (txField === "Logs") {
		const txReceipt = interpreter.runtime.ctx.state.txReceipts.get(tx.txID);
		const logs: Uint8Array[] = txReceipt?.logs ?? [];
		op.checkIndexBound(idx, logs, op.line);
		return parseToStackElem(logs[idx], txField);
	}

	const s = TxnFields[tealVersion][txField]; // 'apaa' or 'apat'
	const result = tx[s as keyof EncTx] as Buffer[]; // array of pk buffers (accounts or appArgs)
	if (!result) {
		// handle defaults
		return TxFieldDefaults[txField];
	}

	/**
	 * handle special case of accounts and applications:
	 * + EncTx.Accounts[0] represents sender's account
	 * + EncTx.Applications[0] represents current_application_id
	 * https://pyteal.readthedocs.io/en/stable/accessing_transaction_field.html#special-case-txn-accounts-and-txn-applications
	 */
	if (txField === "Accounts") {
		if (idx === 0) {
			return parseToStackElem(tx.snd, txField);
		}
		idx--; // if not sender, then reduce index by 1
	} else if (txField === "Applications") {
		if (idx === 0) {
			return parseToStackElem(tx.apid ?? 0n, txField);
		} // during ssc deploy tx.app_id is 0
		idx--;
	}

	op.checkIndexBound(idx, result, line);
	return parseToStackElem(result[idx], txField);
}

/**
 * Check if given encoded transaction obj is asset deletion
 * @param txn Encoded EncTx Object
 * Logic:
 * https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction
 * https://github.com/algorand/js-algorand-sdk/blob/e07d99a2b6bd91c4c19704f107cfca398aeb9619/src/transaction.ts#L528
 */
export function isEncTxAssetDeletion(txn: EncTx): boolean {
	return (
		txn.type === TransactionTypeEnum.ASSET_CONFIG && // type should be asset config
		txn.caid !== undefined &&
		txn.caid !== 0 && // assetIndex should not be 0
		!(txn.apar?.m ?? txn.apar?.r ?? txn.apar?.f ?? txn.apar?.c)
	); // fields should be empty
}

/**
 * Check if given encoded transaction obj is asset config
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetConfig(txn: EncTx): boolean {
	return (
		txn.type === TransactionTypeEnum.ASSET_CONFIG && // type should be asset config
		txn.caid !== undefined &&
		txn.caid !== 0 && // assetIndex should not be 0
		!isEncTxAssetDeletion(txn) // AND should not be asset deletion
	);
}

/**
 * Check if given encoded transaction obj is asset creation
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetCreate(txn: EncTx): boolean {
	return (
		txn.type === TransactionTypeEnum.ASSET_CONFIG && // type should be asset config
		txn.caid === undefined && // assetIndex should be undefined
		txn.apar !== undefined // assetParameters should not be undefined
	);
}
/**
 * Checks if given encoded transaction obj is asset reconfiguration
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetReconfigure(txn: EncTx): boolean {
	return (
		txn.type === TransactionTypeEnum.ASSET_CONFIG && // type should be asset config
		txn.caid !== undefined && // assetIndex should be undefined
		txn.apar !== undefined && // assetParameters should not be undefined
		(txn.apar.m !== undefined || // manager
			txn.apar.f !== undefined || // freeze
			txn.apar.c !== undefined || // clawback
			txn.apar.r !== undefined) // reserve
	);
}
/**
 * Checks if given encoded transaction obj is asset revoke
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetRevoke(txn: EncTx): boolean {
	return txn.asnd !== undefined;
}
/**
 * Checks if given encoded transaction obj is asset freeze
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetFreeze(txn: EncTx): boolean {
	return txn.afrz !== undefined && txn.fadd !== undefined;
}
/**
 * Checks if given encoded transaction obj is asset opt in
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetOptIn(txn: EncTx): boolean {
	if (txn.arcv !== undefined) {
		return !txn.arcv.compare(txn.snd) as boolean;
	} else {
		return false;
	}
}
/**
 * Checks if given encoded transaction obj is asset opt in
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetTransfer(txn: EncTx): boolean {
	return txn.arcv !== undefined && txn.snd !== undefined && txn.asnd === undefined;
}
/**
 * Check if given encoded transaction object is app creation
 * @param txn Encoded EncTx Object
 */
export function isEncTxApplicationCreate(txn: EncTx): boolean {
	return (
		txn.type === TransactionTypeEnum.APPLICATION_CALL &&
		(txn.apan === 0 || txn.apan === undefined) &&
		txn.apid === undefined
	);
}

/**
 * Check if given encoded transaction object is application call
 * @param txn Encode EncTx Object
 */
export function isEncTxApplicationCall(txn: EncTx): boolean {
	return txn.type === TransactionTypeEnum.APPLICATION_CALL && txn.apid !== undefined;
}

/**
 *
 * @param txAndSign transaction and sign
 * @param ctx context which is tx and sign apply
 * @returns ExecParams object equivalent with txAndSign
 */
export function transactionAndSignToExecParams(
	txAndSign: types.TransactionAndSign,
	ctx: Context
): types.ExecParams {
	const transaction = txAndSign.transaction as any;
	const encTx = transaction.get_obj_for_encoding() as EncTx;
	// inject approval Program and clear program with string format.
	// TODO: should create function to convert TEAL in Uint8Array to string format?
	encTx.approvalProgram = transaction.approvalProgram;
	encTx.clearProgram = transaction.clearProgram;
	const sign = txAndSign.sign;
	return encTxToExecParams(encTx, sign, ctx);
}

/* eslint-disable sonarjs/cognitive-complexity */
export function encTxToExecParams(
	encTx: EncTx,
	sign: types.Sign,
	ctx: Context,
	line?: number
): types.ExecParams {
	const execParams: any = {
		...sign,
		payFlags: {} as types.ExecParams,
	};

	execParams.payFlags.totalFee = encTx.fee;
	if (ArrayBuffer.isView(encTx.type)) {
		encTx.type = Buffer.from(encTx.type).toString("utf-8");
	}
	switch (encTx.type) {
		case TransactionTypeEnum.APPLICATION_CALL: {
			if (isEncTxApplicationCreate(encTx)) {
				const appDefinition: types.AppDefinition = {
					appName: "Mock",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: encTx.approvalProgram as string,
					clearProgramFilename: encTx.clearProgram as string,
					localInts: encTx.apls?.nui as number,
					localBytes: encTx.apls?.nbs as number,
					globalInts: encTx.apgs?.nui as number,
					globalBytes: encTx.apgs?.nbs as number,
				};
				execParams.type = types.TransactionType.DeployApp;
				execParams.appDefinition = appDefinition;
			} else if (isEncTxApplicationCall(encTx)) {
				execParams.type = types.TransactionType.CallApp;
				execParams.appID = encTx.apid;
				execParams.appArgs = encTx.apaa;
			}
			break;
		}

		case TransactionTypeEnum.PAYMENT: {
			execParams.type = types.TransactionType.TransferAlgo;
			execParams.fromAccountAddr = _getAddress(encTx.snd);
			execParams.toAccountAddr =
				getRuntimeAccountAddr(encTx.rcv, ctx, line) ?? ZERO_ADDRESS_STR;
			execParams.amountMicroAlgos = encTx.amt ? BigInt(encTx.amt) : 0n;
			if (encTx.close) {
				execParams.payFlags.closeRemainderTo = getRuntimeAccountAddr(encTx.close, ctx, line);
			}
			if (encTx.rekey) {
				execParams.payFlags.rekeyTo = _getAddress(encTx.rekey);
			}
			break;
		}
		case TransactionTypeEnum.ASSET_FREEZE: {
			execParams.type = types.TransactionType.FreezeAsset;
			execParams.assetID = encTx.faid;
			execParams.freezeTarget = getRuntimeAccountAddr(encTx.fadd, ctx, line);
			execParams.freezeState = BigInt(encTx.afrz ?? 0n) === 1n;
			if (encTx.rekey) {
				execParams.payFlags.rekeyTo = _getAddress(encTx.rekey);
			}
			break;
		}
		case TransactionTypeEnum.ASSET_TRANSFER: {
			if (encTx.asnd !== undefined) {
				// if 'AssetSender' is set, it is clawback transaction
				execParams.type = types.TransactionType.RevokeAsset;
				execParams.recipient = getRuntimeAccountAddr(encTx.arcv, ctx, line) ?? ZERO_ADDRESS_STR;
				execParams.revocationTarget = getRuntimeAccountAddr(encTx.asnd, ctx, line);
			} else {
				// asset transfer
				execParams.type = types.TransactionType.TransferAsset;
				execParams.toAccountAddr = getRuntimeAccountAddr(encTx.arcv, ctx) ?? ZERO_ADDRESS_STR;
			}
			// set common fields (asset amount, index, closeRemainderTo)
			execParams.amount = encTx.aamt ? BigInt(encTx.aamt) : 0n;
			execParams.assetID = encTx.xaid ?? 0;
			// option fields
			if (encTx.aclose) {
				execParams.payFlags.closeRemainderTo = getRuntimeAccountAddr(encTx.aclose, ctx, line);
			}
			if (encTx.rekey) {
				execParams.payFlags.rekeyTo = _getAddress(encTx.rekey);
			}
			break;
		}

		case TransactionTypeEnum.ASSET_CONFIG: {
			if (isEncTxAssetDeletion(encTx)) {
				execParams.type = types.TransactionType.DestroyAsset;
				execParams.assetID = encTx.caid;
			} else if (isEncTxAssetConfig(encTx)) {
				// from the docs: all fields must be reset, otherwise they will be cleared
				// https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/#asset-configuration
				execParams.type = types.TransactionType.ModifyAsset;
				execParams.assetID = encTx.caid;
				execParams.fields = {
					manager: _getASAConfigAddr(encTx.apar?.m),
					reserve: _getASAConfigAddr(encTx.apar?.r),
					clawback: _getASAConfigAddr(encTx.apar?.c),
					freeze: _getASAConfigAddr(encTx.apar?.f),
				};
			} else {
				// if not delete or modify, it's ASA deployment
				execParams.type = types.TransactionType.DeployASA;
				execParams.asaName = encTx.apar?.an;
				execParams.asaDef = {
					name: encTx.apar?.an,
					total: Number(encTx.apar?.t),
					decimals: encTx.apar?.dc !== undefined ? Number(encTx.apar.dc) : 0,
					defaultFrozen: BigInt(encTx.apar?.df ?? 0n) === 1n,
					unitName: encTx.apar?.un,
					url: encTx.apar?.au,
					metadataHash: encTx.apar?.am ? convertToString(encTx.apar?.am) : undefined,
					manager: _getASAConfigAddr(encTx.apar?.m),
					reserve: _getASAConfigAddr(encTx.apar?.r),
					clawback: _getASAConfigAddr(encTx.apar?.c),
					freeze: _getASAConfigAddr(encTx.apar?.f),
				};
			}
			break;
		}

		case TransactionTypeEnum.KEY_REGISTRATION: {
			execParams.type = types.TransactionType.KeyRegistration;
			// execParams.voteKey = encTx.votekey?.toString("base64");
			if (encTx.votekey !== undefined) {
				execParams.voteKey = Buffer.from(encTx.votekey).toString("base64");
			}
			// execParams.selectionKey = encTx.selkey?.toString("base64");
			if (encTx.selkey !== undefined) {
				execParams.selectionKey = Buffer.from(encTx.selkey).toString("base64");
			}
			execParams.voteFirst = encTx.votefst;
			execParams.voteLast = encTx.votelst;
			execParams.voteKeyDilution = encTx.votekd;
			break;
		}

		default: {
			// if line is defined => called from ItxnSubmit
			// => throw error with itxn_submit
			if (line) {
				throw new Error(`unsupported type for itxn_submit at line ${line}`);
			} else {
				throw new Error("Can't convert encode tx to execParams");
			}
		}
	}
	return execParams as types.ExecParams;
}

const _getASAConfigAddr = (addr?: Uint8Array): string => {
	if (addr) {
		return encodeAddress(addr);
	}
	return "";
};

const getRuntimeAccount = (
	publicKey: Buffer | undefined,
	ctx: Context,
	line?: number
): RuntimeAccountI | undefined => {
	if (publicKey === undefined) {
		return undefined;
	}
	const address = encodeAddress(Uint8Array.from(publicKey));
	const runtimeAcc = ctx.getAccount(address);
	return runtimeAcc.account;
};

const getRuntimeAccountAddr = (
	publickey: Buffer | undefined,
	ctx: Context,
	line?: number
): types.AccountAddress | undefined => {
	return getRuntimeAccount(publickey, ctx, line)?.addr;
};

const _getAddress = (addr?: Uint8Array): string | undefined => {
	if (addr) {
		return encodeAddress(addr);
	}
	return undefined;
};

export interface CreditFeeType {
	remainingFee: number;
	collectedFee: number;
	requiredFee: number;
}

/**
 *
 * @param groupTx group transaction
 * @returns remainingFee - fee remaining after execute group Tx
 * 			collected fee - fee collected from group Tx
 * 			required fee - fee require to execute group tx
 */
export function calculateFeeCredit(groupTx: EncTx[]): CreditFeeType {
	let collectedFee = 0;
	for (const tx of groupTx) {
		collectedFee += tx.fee ?? 0;
	}
	const requiredFee = groupTx.length * ALGORAND_MIN_TX_FEE;
	return {
		remainingFee: collectedFee - requiredFee,
		collectedFee,
		requiredFee,
	};
}

/**
 * Retunrs field f of the last inner transaction
 * @param op ITxna or ITxn opcode
 * @returns result
 */
export function executeITxn(op: ITxna | ITxn): StackElem {
	const groupTx = op.interpreter.innerTxnGroups[op.interpreter.innerTxnGroups.length - 1];
	const tx = groupTx[groupTx.length - 1];
	let result: StackElem;
	switch (op.field) {
		case "Logs": {
			const txReceipt = op.interpreter.runtime.ctx.state.txReceipts.get(tx.txID);
			const logs: Uint8Array[] = txReceipt?.logs ?? [];
			op.checkIndexBound(op.idx, logs, op.line);
			result = logs[op.idx];
			break;
		}
		case "NumLogs": {
			const txReceipt = op.interpreter.runtime.ctx.state.txReceipts.get(tx.txID);
			const logs: Uint8Array[] = txReceipt?.logs ?? [];
			result = BigInt(logs.length);
			break;
		}
		default: {
			result = txnSpecByField(op.field, tx, [tx], op.interpreter);
			if (result === undefined || Object(result).length === 0) {
				result = txAppArg(op.field, tx, op.idx, op, op.interpreter, op.line);
				break;
			}
		}
	}
	return result;
}
