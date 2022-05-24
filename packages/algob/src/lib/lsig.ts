/* eslint @typescript-eslint/no-var-requires: "off" */
import {
	getPathFromDirRecursive,
	loadFromYamlFileSilent,
	types as rtypes,
} from "@algo-builder/runtime";
import { Algodv2, LogicSigAccount, MultisigMetadata } from "algosdk";

import { CACHE_DIR } from "../internal/core/project-structure";
import type { ASCCache, SCParams } from "../types";
import { CompileOp } from "./compile";

/**
 * Make logic signature from result
 * @param result : ASC cache (contains filename, hash, tealcode ..etc)
 */
export async function _lsigFromRes(result: ASCCache): Promise<LogicSigAccount> {
	const program = result.base64ToBytes;
	const lsigAccount = new LogicSigAccount(program, []);
	// below line saves data in cp is {tag: <value>} which we need, otherwise it'll save as
	// { type: 'buffer', data: <value> } and throws error upon running examples
	if (lsigAccount.lsig.tag) {
		lsigAccount.lsig.tag = new Uint8Array(lsigAccount.lsig.tag) as Buffer;
	}
	return lsigAccount;
}

/**
 * Make logic signature from .teal file
 * @param name : ASC filename
 * @param algodClient : algodClient
 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
 */
export async function getLsig(
	name: string,
	algodClient: Algodv2,
	scTmplParams?: SCParams
): Promise<LogicSigAccount> {
	const compileOp = new CompileOp(algodClient);
	const result: ASCCache = await compileOp.ensureCompiled(name, "", false, scTmplParams);
	return await _lsigFromRes(result);
}

/**
 * Make logic signature from "cached" teal code
 * @param name : ASC filename
 */
export async function getLsigFromCache(filename: string): Promise<LogicSigAccount> {
	const filePath = getPathFromDirRecursive(CACHE_DIR, filename + ".yaml") as string;
	const result: ASCCache = loadFromYamlFileSilent(filePath);
	return await _lsigFromRes(result);
}

/**
 * Create and return a dummy logic signature
 */
export function getDummyLsig(): LogicSigAccount {
	return new LogicSigAccount(new Uint8Array(56), []);
}

/**
 * Appends signature (using signer's sk) to multi-signed logic signature. If multisig is not found
 * then new multisig is created
 * eg. appending own signature to a signed lsig (received from multisignature account address network)
 * @param lsig Logic Sig object
 * @param signer: Signer Account which will sign the smart contract
 * @param mparams: passed when signing a new multisig
 * @returns multi signed logic signature (with appended signature using signer's sk)
 */
export function signLogicSigMultiSig(
	lsigAccount: LogicSigAccount,
	signer: rtypes.Account,
	mparams?: MultisigMetadata
): LogicSigAccount {
	if (lsigAccount.lsig.msig === undefined) {
		// if multisig not found, create new msig
		if (mparams === undefined) {
			throw new Error(
				"MultiSig Metadata is undefined, which is required for single sign multisig"
			);
		}
		lsigAccount.signMultisig(mparams, signer.sk);
	} else {
		lsigAccount.appendToMultisig(signer.sk); // else append signature to msig
	}
	return lsigAccount;
}
