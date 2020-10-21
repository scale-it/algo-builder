import fs from "fs";
import { decode } from 'hi-base32';
import path from "path";

import { ASSETS_DIR } from "../internal/core/project-structure";
import { MultiSig } from "../types";

const msigExt = ".msig";
const tealExt = ".teal";

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
 * @param {string} msig : multisigned msig obj
 * @returns {[string, string]} : cached .teal filename, raw msig object as string
 */
export async function readMsigFromFile (filename: string): Promise<Object> {
  if (!filename.endsWith(msigExt)) {
    throw new Error(`filename "${filename}" must end with "${msigExt}"`);
  }
  try {
    const p = path.join(ASSETS_DIR, filename);
    const [tealCode, Msig] = fs.readFileSync(p, 'utf8').split("LogicSig: ");

    // Extracting teal code from .msig and dumping to .teal to get logic signature
    const tealFile = filename.split(msigExt)[0] + '-cache' + tealExt;
    const tealPath = path.join(ASSETS_DIR, tealFile); // assets/<file_name>.teal
    fs.writeFileSync(tealPath, tealCode); // Write logic code to file with .teal ext

    // return msig object of logic signature to decode further
    return [tealFile, Msig];
  } catch (e) {
    if (e?.errno === -2) { return ''; } // errno whene reading an unexisting file
    throw e;
  }
}
