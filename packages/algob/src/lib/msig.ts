import fs from "fs";
import { decode } from 'hi-base32';
import path from "path";

import { ASSETS_DIR } from "../internal/core/project-structure";
import { MultiSig } from "../types";

const msigExt = ".msig";

/**
 * Description: this function decodes msig object from logic signature
 * @param {String} name : multisig filename
 * @returns {LogicSig} : decoded msig (object with decoded public keys and their signatures)
 */
export async function decodeMsigObj (msig: string): Promise<MultiSig> {
  const parsedMsig = JSON.parse(msig).msig;

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
 * Description: this function reads multisig from /assets/<filename>.msig
 *              and returns the decoded multisig object
 * @param {string} msig : multisigned msig obj
 * @returns {MultiSig} : decoded Msig Object
 */
export async function readMsigFromFile (filename: string): Promise<MultiSig | undefined> {
  if (!filename.endsWith(msigExt)) {
    throw new Error(`filename "${filename}" must end with "${msigExt}"`);
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
 * Description: this function reads raw multisig from /assets/<filename>.msig
 * and returns the base64 string
 * @param {string} filename : filename [must have .msig ext]
 * @returns {string} : base64 string
 */
export async function readBinaryMultiSig (filename: string): Promise<string | undefined> {
  if (!filename.endsWith(msigExt)) {
    throw new Error(`filename "${filename}" must end with "${msigExt}"`);
  }
  try {
    const p = path.join(ASSETS_DIR, filename);
    return fs.readFileSync(p, 'base64');
  } catch (e) {
    if (e?.errno === -2) return undefined; // handling a not existing file
    throw e;
  }
}
