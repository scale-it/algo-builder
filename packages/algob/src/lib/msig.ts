import * as msgpack from "algo-msgpack-with-bigint";
import fs from "fs";
import { decode } from 'hi-base32';
import path from "path";

import { ASSETS_DIR } from "../internal/core/project-structure";
import { LogicSig, MultiSig, RawLsig } from "../types";
import { getDummyLsig } from "./lsig";

export const blsigExt = ".blsig";
const lsigExt = ".lsig";

/**
 * Description: this function decodes msig object from logic signature
 * @param {String} name : multisig filename
 * @returns {LogicSig} : decoded msig (object with decoded public keys and their signatures)
 */
export async function decodeMsigObj (msig: string): Promise<MultiSig> {
  const parsedMsig = JSON.parse(msig).msig;
  validateMsig(parsedMsig);

  // decoding multisigned logic signature
  for (const acc of parsedMsig.subsig) {
    const decoded = decode.asBytes(acc.pk); // decoding base32 string (public key)
    acc.pk = new Uint8Array(decoded.slice(0, 32));
    if (acc.s) {
      acc.s = new Uint8Array(Buffer.from(acc.s, 'base64')); // decode base64 signature (signed pk)
    }
  }
  return parsedMsig;
}

/**
 * Description: this function reads multisig from /assets/<filename>.lsig
 *              and returns the decoded multisig object
 * @param {string} msig : multisigned msig obj
 * @returns {MultiSig} : decoded Msig Object
 */
export async function readMsigFromFile (filename: string): Promise<MultiSig | undefined> {
  if (!filename.endsWith(lsigExt)) {
    throw new Error(`filename "${filename}" must end with "${lsigExt}"`);
  }
  try {
    const p = path.join(ASSETS_DIR, filename);
    const Msig = fs.readFileSync(p, 'utf8').split("LogicSig: ")[1];
    return await decodeMsigObj(Msig);
  } catch (e) {
    if (e?.errno === -2) return undefined; // handling a not existing file
    throw e;
  }
}

/**
 * Description: this function reads raw multisig from /assets/<filename>.lsig
 * and returns the base64 string
 * @param {string} filename : filename [must have .blsig ext]
 * @returns {string} : base64 string
 */
export async function readBinaryMultiSig (filename: string): Promise<string | undefined> {
  if (!filename.endsWith(blsigExt)) {
    throw new Error(`filename "${filename}" must end with "${blsigExt}"`);
  }
  try {
    const p = path.join(ASSETS_DIR, filename);
    return fs.readFileSync(p, 'base64');
  } catch (e) {
    if (e?.errno === -2) return undefined; // handling a not existing file
    throw e;
  }
}

/**
 * Description : loads multisigned logic signature directly from .blsig file
 * @param {string} name filename
 * @returns {LogicSig} multi signed logic signature from assets/<file_name>.blsig
 */
export async function loadBinaryMultiSig (name: string): Promise<LogicSig> {
  // get logic signature from file and decode it
  const data = await readBinaryMultiSig(name);
  const program = new Uint8Array(Buffer.from(data as string, 'base64'));
  const logicSignature = msgpack.decode(program) as RawLsig;
  validateMsig(logicSignature.msig);

  // assign complete logic signature
  const lsig = getDummyLsig();
  lsig.logic = logicSignature.l as Uint8Array; // assign logic part separately (as keys mismatch: logic, l)
  delete logicSignature.l;
  Object.assign(lsig, logicSignature);
  return lsig;
}

/**
 * Description : validates msig by checking for v and thr field
 * @param {MultiSig} msig
 */
export function validateMsig (msig: MultiSig | undefined): void {
  if (msig === undefined || msig.v === undefined || msig.thr === undefined) {
    throw new Error("Error fetching multisigned logic signature from file - invalid/undefined msig");
  }
}
