/* eslint @typescript-eslint/no-var-requires: "off" */
import algosdk from "algosdk";

import { ASCCache, LogicSig } from "../types";
import { CompileOp } from "./compile";

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
 * Description: this function creates and returns a dummy logic signature
 */
export function getDummyLsig (): LogicSig {
  return algosdk.makeLogicSig(new Uint8Array(56), []);
}
