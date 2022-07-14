import { parseASADef, types as rtypes } from "@algo-builder/runtime";
import {
	BuilderError,
	ERRORS,
	getSuggestedParams,
	mkTxParams,
	tx as webTx,
	types as wtypes,
} from "@algo-builder/web";
import algosdk, { decodeSignedTransaction, SuggestedParams, Transaction } from "algosdk";

import { ConfirmedTxInfo, Deployer, TxnReceipt } from "../types";
import { loadEncodedTxFromFile } from "./files";
import { registerCheckpoints } from "./script-checkpoints";

/**
 * Returns true if encoded transaction (fetched from file) is already signed
 * @param encodedTx msgpack encoded transaction */
export function isSignedTx(encodedTx: Uint8Array): boolean {
	try {
		decodeSignedTransaction(encodedTx);
	} catch (error) {
		return false;
	}
	return true;
}

/**
 * Returns SDK transaction object for ASA creation
 * @param name asset name
 * @param asaDef asset definition (passed in `/assets/asa.yaml)
 * @param flags basic transaction flags like `feePerByte`, `totalFee`, etc
 * @param txSuggestedParams suggested transaction params
 */
export function makeAssetCreateTxn(
	name: string,
	asaDef: wtypes.ASADef,
	flags: rtypes.ASADeploymentFlags,
	txSuggestedParams: SuggestedParams
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
export function makeASAOptInTx(
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
		payFlags: payFlags,
	};
	return webTx.mkTransaction(execParam, params);
}

/**
 * Returns signed transaction
 * @param txn unsigned transaction
 * @param signer sign and secret key parameters
 */
function signTransaction(txn: Transaction, signer: wtypes.Sign): Uint8Array {
	switch (signer.sign) {
		case wtypes.SignType.SecretKey: {
			return txn.signTxn(signer.fromAccount.sk);
		}
		case wtypes.SignType.LogicSignature: {
			signer.lsig.lsig.args = signer.args ?? [];
			return algosdk.signLogicSigTransactionObject(txn, signer.lsig).blob;
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
async function mkTx(
	deployer: Deployer,
	txn: wtypes.ExecParams,
	index: number,
	txIdxMap: Map<number, [string, wtypes.ASADef]>
): Promise<Transaction> {
	// if execParams for ASA related transaction have assetID as asaName,
	// then set to assetIndex using info from checkpoint
	switch (txn.type) {
		case wtypes.TransactionType.OptInASA:
		case wtypes.TransactionType.TransferAsset:
		case wtypes.TransactionType.ModifyAsset:
		case wtypes.TransactionType.FreezeAsset:
		case wtypes.TransactionType.RevokeAsset: {
			if (typeof txn.assetID === "string") {
				const asaInfo = deployer.getASAInfo(txn.assetID);
				txn.assetID = asaInfo.assetIndex;
			}
			break;
		}
		case wtypes.TransactionType.DestroyAsset: {
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
			if (txn.asaDef === undefined) {
				txn.asaDef = deployer.getASADef(txn.asaName, txn.overrideAsaDef);
			}
			parseASADef(txn.asaDef);
			deployer.assertNoAsset(txn.asaName);
			txIdxMap.set(index, [txn.asaName, txn.asaDef]);
			break;
		}
		case wtypes.TransactionType.DeployApp: {
			const appDefinition = txn.appDefinition;
			const name = appDefinition.appName;
			deployer.assertNoApp(name);
			const appProgramBytes = await deployer.compileApplication(name, appDefinition);
			txn.appDefinition = {
				...appDefinition,
				...appProgramBytes,
			};

			txIdxMap.set(index, [
				name,
				{ total: 1, decimals: 1, unitName: "MOCK", defaultFrozen: false },
			]);
			break;
		}
		case wtypes.TransactionType.UpdateApp: {
			const cpKey = txn.appName;
			txn.newAppCode = await deployer.compileApplication(txn.appName, txn.newAppCode);
			txIdxMap.set(index, [
				cpKey,
				{ total: 1, decimals: 1, unitName: "MOCK", defaultFrozen: false },
			]);
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
	return webTx.mkTransaction(
		txn,
		await mkTxParams(deployer.algodClient, txn.payFlags, Object.assign({}, suggestedParams))
	);
}

/**
 * Create and Sign SDK transaction(s) from transaction execution parameters (passed by user).
 * @param deployer Deployer object
 * @param execParams Execution parameters
 * @param txIdxMap Map for index to [cpname, asaDef]
 * @returns [transaction(s), signed transaction(s)]
 */
export async function makeAndSignTx(
	deployer: Deployer,
	execParams: wtypes.ExecParams | wtypes.ExecParams[],
	txIdxMap: Map<number, [string, wtypes.ASADef]>
): Promise<[Transaction[], Uint8Array | Uint8Array[]]> {
	let signedTxn;
	let txns: Transaction[] = [];
	if (Array.isArray(execParams)) {
		if (execParams.length > 16) {
			throw new Error("Maximum size of an atomic transfer group is 16");
		}

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
	return [txns, signedTxn];
}

/**
 * Signs transaction object(s) and returns raw signed transaction
 * Note: `signTransaction` is used to sign single transaction and `signTransactions` takes
 * array of SDK transaction object with signers, signs it.
 * @param txnAndSign Transaction object(s) with signers
 */
export function signTransactions(txnAndSign: wtypes.TransactionAndSign[]): Uint8Array[] {
	let txns: Transaction[] = [];
	const signers: wtypes.Sign[] = [];
	for (const [idx, value] of txnAndSign.entries()) {
		txns[idx] = value.transaction;
		signers[idx] = value.sign;
	}
	txns = algosdk.assignGroupID(txns);
	return txns.map((txn: Transaction, index: number) => {
		return signTransaction(txn, signers[index]);
	});
}

/**
 * This function should not be used directly.
 * Execute single transaction or group of transactions (atomic transaction)
 * executes `ExecParams` or `Transaction` Object, SDK Transaction object passed to this function
 * will be signed and sent to network. User can use SDK functions to create transactions.
 * Note: If passing transaction object a signer/s must be provided.
 * @param deployer Deployer
 * @param transactions transaction parameters or atomic transaction parameters
 * https://github.com/scale-it/algo-builder/blob/docs/docs/guide/execute-transaction.md
 * or TransactionAndSign object(SDK transaction object and signer parameters)
 */
export async function executeTx(
	deployer: Deployer,
	transactions: wtypes.ExecParams[] | wtypes.TransactionAndSign[]
): Promise<TxnReceipt[]> {
	let isSDK = false;
	let signedTxn;
	if (transactions.length === 0) {
		throw new BuilderError(ERRORS.GENERAL.EXECPARAMS_LENGTH_ERROR);
	}
	if (wtypes.isSDKTransactionAndSign(transactions[0])) {
		signedTxn = signTransactions(transactions as wtypes.TransactionAndSign[]);
		isSDK = true;
	}

	if (isSDK && signedTxn) {
		await deployer.sendAndWait(signedTxn);
		return await deployer.getReceiptTxns(
			(transactions as wtypes.TransactionAndSign[]).map((txn) => txn.transaction)
		);
	}

	const execParams = transactions as wtypes.ExecParams[];

	deployer.assertCPNotDeleted(execParams);
	try {
		const txIdxMap = new Map<number, [string, wtypes.ASADef]>();
		const [txns, signedTxn] = await makeAndSignTx(deployer, execParams, txIdxMap);
		await deployer.sendAndWait(signedTxn);
		const confirmedTx = await deployer.getReceiptTxns(txns);
		console.debug(confirmedTx);
		if (deployer.isDeployMode) {
			await registerCheckpoints(deployer, execParams, txns, txIdxMap);
		} else {
			console.warn("deploy app/asset will not be stored in checkpoint in run mode");
		}
		return confirmedTx;
	} catch (error) {
		if (deployer.isDeployMode) {
			deployer.persistCP();
		}

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
export async function executeSignedTxnFromFile(
	deployer: Deployer,
	fileName: string
): Promise<ConfirmedTxInfo> {
	const signedTxn = loadEncodedTxFromFile(fileName);
	if (signedTxn === undefined) {
		throw new Error(`File ${fileName} does not exist`);
	}

	console.debug(
		"Decoded txn from %s: %O",
		fileName,
		algosdk.decodeSignedTransaction(signedTxn)
	);
	const confirmedTx = await deployer.sendAndWait(signedTxn);
	console.debug(confirmedTx);
	return confirmedTx;
}
