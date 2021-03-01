/* eslint @typescript-eslint/no-var-requires: "off" */
import type { LogicSig, LogicSigArgs } from "algosdk";
import algosdk from "algosdk";

import type { ASCCache, SCParams } from "../types";
import { CompileOp } from "./compile";

/**
 * Description: this function makes logic signature from .teal file
 * @param name : ASC filename
 * @param algodClient : algodClient
 * @param scParams : smart contract parameters
 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
 */
export async function getLsig (
  name: string,
  algodClient: algosdk.Algodv2,
  scParams: LogicSigArgs,
  scTmplParams?: SCParams):
  Promise<LogicSig> {
  const compileOp = new CompileOp(algodClient);
  const result: ASCCache = await compileOp.ensureCompiled(name, false, scTmplParams);
  const program = result.base64ToBytes;
  return algosdk.makeLogicSig(program, scParams);
}

/**
 * Description: this function creates and returns a dummy logic signature
 */
export function getDummyLsig (): LogicSig {
  return algosdk.makeLogicSig(new Uint8Array(56), []);
}
