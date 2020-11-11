/* eslint @typescript-eslint/no-var-requires: "off" */
import type { LogicSig, LogicSigArgs } from "algosdk";
import algosdk from "algosdk";

import { ASCCache } from "../types";
import { CompileOp } from "./compile";

/**
 * Description: this function makes logic signature from .teal file
 * @param name : ASC filename
 * @param scParams : parameters
 * @param algodClient : algodClient
 */
export async function getLsig (name: string, scParams: LogicSigArgs, algodClient: algosdk.Algodv2):
Promise<LogicSig> {
  const compileOp = new CompileOp(algodClient);
  const result: ASCCache = await compileOp.ensureCompiled(name, false);
  const program = result.toBytes;
  return algosdk.makeLogicSig(program, scParams);
}

/**
 * Description: this function creates and returns a dummy logic signature
 */
export function getDummyLsig (): LogicSig {
  return algosdk.makeLogicSig(new Uint8Array(56), []);
}
