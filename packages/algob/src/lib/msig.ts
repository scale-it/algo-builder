import { getPathFromDirRecursive } from "@algo-builder/runtime";
import {
	Account,
	appendSignMultisigTransaction,
	decodeAddress,
	decodeSignedTransaction,
	decodeUnsignedTransaction,
	encodeAddress,
	EncodedMultisig,
	logicSigFromByte,
	MultisigMetadata,
	signMultisigTransaction,
	Transaction,
} from "algosdk";
import fs from "fs";

import { ASSETS_DIR } from "../internal/core/project-structure";
import { LogicSig } from "../types";
import { NO_FILE_OR_DIRECTORY_ERROR } from "./constants";
import { isSignedTx } from "./tx";

export const blsigExt = ".blsig";
const lsigExt = ".lsig";

/**
 * This function decodes msig object from logic signature
 * @param {String} name : multisig filename
 * @returns {MultiSig} : decoded msig (object with decoded public keys and their signatures)
 */
export async function decodeMsigObj(msig: string): Promise<EncodedMultisig> {
	const parsedMsig = JSON.parse(msig).msig;
	validateMsig(parsedMsig);

	// decoding multisigned logic signature
	for (const acc of parsedMsig.subsig) {
		acc.pk = decodeAddress(acc.pk).publicKey;
		if (acc.s) {
			acc.s = new Uint8Array(Buffer.from(acc.s, "base64")); // decode base64 signature (signed pk)
		}
	}
	return parsedMsig;
}

/**
 * This function reads multisig from /assets/<filename>.lsig
 *              and returns the decoded multisig object
 * @param {string} msig : multisigned msig obj
 * @returns {MultiSig} : decoded Msig Object
 */
export async function readMsigFromFile(filename: string): Promise<EncodedMultisig | undefined> {
	if (!filename.endsWith(lsigExt)) {
		throw new Error(`filename "${filename}" must end with "${lsigExt}"`);
	}
	try {
		const p = getPathFromDirRecursive(ASSETS_DIR, filename) as string;
		const msig = fs.readFileSync(p, "utf8").split("LogicSig: ")[1];
		return await decodeMsigObj(msig);
	} catch (e) {
		if ((e as NodeJS.ErrnoException)?.code === NO_FILE_OR_DIRECTORY_ERROR) {
			return undefined;
		} // handling a not existing file
		throw e;
	}
}

/**
 * This function reads raw multisig from /assets/<filename>.lsig
 * and returns the base64 string
 * @param {string} filename : filename [must have .blsig ext]
 * @returns {string} : base64 string
 */
export async function readBinaryMultiSig(filename: string): Promise<string | undefined> {
	if (!filename.endsWith(blsigExt)) {
		throw new Error(`filename "${filename}" must end with "${blsigExt}"`);
	}
	try {
		const p = getPathFromDirRecursive(ASSETS_DIR, filename) as string;
		return fs.readFileSync(p, "base64");
	} catch (e) {
		if ((e as NodeJS.ErrnoException)?.code === NO_FILE_OR_DIRECTORY_ERROR) {
			return undefined;
		} // handling a not existing file
		throw e;
	}
}

/**
 * Loads signed logic signature directly from .blsig file
 * @param {string} name filename
 * @returns {LogicSig} signed logic signature from assets/<file_name>.blsig
 */
export async function loadBinaryLsig(name: string): Promise<LogicSig> {
	const data = await readBinaryMultiSig(name);
	if (data === undefined) {
		throw new Error(`File ${name} does not exist`);
	}
	const program = new Uint8Array(Buffer.from(data, "base64"));
	return logicSigFromByte(program);
}

/**
 * Validates msig by checking for v and thr field
 * @param {MultiSig} msig
 */
export function validateMsig(msig: EncodedMultisig | undefined): void {
	if (msig === undefined || msig.v === undefined || msig.thr === undefined) {
		throw new Error(
			"Error fetching multisigned logic signature from file - invalid/undefined msig"
		);
	}
}

/**
 * Signs a raw multi-sig transaction object
 * @param signerAccount account(addr, sk) to sign the transaction
 * @param rawTxn encoded transaction fetched from file in /assets
 * @param mparams multisig metadata. Required if creating a new signed multisig transaction.
 * @returns signed transaction object
 */
export function signMultiSig(
	signerAccount: Account,
	rawTxn: Uint8Array,
	mparams?: MultisigMetadata
): { txID: string; blob: Uint8Array } {
	let decodedTxn, msig;
	let multisigMetaData: MultisigMetadata; // extracted from existing multisig OR passed by user
	if (isSignedTx(rawTxn)) {
		decodedTxn = decodeSignedTransaction(rawTxn);
		msig = decodedTxn.msig as EncodedMultisig;
		validateMsig(msig);
		const addresses = [];
		for (const sig of msig.subsig) {
			addresses.push(encodeAddress(Uint8Array.from(sig.pk)));
		}
		multisigMetaData = {
			version: msig.v,
			threshold: msig.thr,
			addrs: addresses,
		};
	} else {
		if (mparams === undefined) {
			throw new Error(
				`Multisig MetaData (version, threshold, addresses) not passed. This is required for creating a new multisig. Aborting`
			);
		}
		decodedTxn = decodeUnsignedTransaction(rawTxn);
		multisigMetaData = mparams;
	}
	console.log("Msig: %O", msig);

	// note: append requires raw(encoded) transaction object, but signMultisig requires decoded tx obj
	const signedTxn = isSignedTx(rawTxn)
		? appendSignMultisigTransaction(rawTxn, multisigMetaData, signerAccount.sk)
		: signMultisigTransaction(decodedTxn as Transaction, multisigMetaData, signerAccount.sk);
	const decodedSignedTxn = decodeSignedTransaction(signedTxn.blob);
	console.log("Msig: %O", decodedSignedTxn.msig);
	return signedTxn;
}
