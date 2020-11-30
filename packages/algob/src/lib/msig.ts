import type { LogicSig, MultiSig } from "algosdk";
import { decodeAddress, logicSigFromByte } from "algosdk";
import fs from "fs";
import path from "path";

import { ASSETS_DIR } from "../internal/core/project-structure";

export const blsigExt = ".blsig";
const lsigExt = ".lsig";

/**
 * Description: this function decodes msig object from logic signature
 * @param {String} name : multisig filename
 * @returns {MultiSig} : decoded msig (object with decoded public keys and their signatures)
 */
export async function decodeMsigObj (msig: string): Promise<MultiSig> {
  const parsedMsig = JSON.parse(msig).msig;
  validateMsig(parsedMsig);

  // decoding multisigned logic signature
  for (const acc of parsedMsig.subsig) {
    acc.pk = decodeAddress(acc.pk).publicKey;
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
    const msig = fs.readFileSync(p, 'utf8').split("LogicSig: ")[1];
    return await decodeMsigObj(msig);
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
  const data = await readBinaryMultiSig(name);
  if (data === undefined) {
    throw new Error(`File ${name} does not exist`);
  }
  const program = new Uint8Array(Buffer.from(data, 'base64'));
  return logicSigFromByte(program);
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
