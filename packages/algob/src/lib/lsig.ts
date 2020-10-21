/* eslint @typescript-eslint/no-var-requires: "off" */
import algosdk from "algosdk";
import { decode } from 'hi-base32';

import { ASCCache, LogicSig, MultiSig } from "../types";
import { CompileOp } from "./compile";
export const logicsig = require("algosdk/src/logicsig");

/**
 * Description: this function makes logic signature from .teal file
 * @param name : ASC filename
 * @param scParams : parameters
 * @param algodClient : algodClient
 */
export async function getLsig (name: string, scParams: Object, algodClient: algosdk.Algodv2): Promise<any> {
  const compileOp = new CompileOp(algodClient);
  const result: ASCCache = await compileOp.ensureCompiled(name, false);
  const program = result.toBytes;
  return algosdk.makeLogicSig(program, scParams);
}

/**
 * Description: this function decodes msig object from logic signature
 * @param {string} msig : multisigned msig obj
 * @returns {LogicSig} : decoded msig (object with decoded public keys and their signatures)
 */
export async function decodeMsigObj (msig: string): Promise<MultiSig> {
  const parsedMsig = JSON.parse(msig).msig;

  // decoding multisigned logic signature
  for (const acc of parsedMsig.subsig) {
    const decoded = decode.asBytes(acc.pk);
    acc.pk = new Uint8Array(decoded.slice(0, 32)); // decode public key
    if (acc.s) { // decode if addr is signed
      acc.s = new Uint8Array(Buffer.from(acc.s, 'base64'));
    }
  }
  return parsedMsig;
}
