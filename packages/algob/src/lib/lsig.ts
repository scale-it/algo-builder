/* eslint @typescript-eslint/no-var-requires: "off" */
import algosdk from "algosdk";

import { ASCCache } from "../types";
import { CompileOp } from "./compile";

export const DUMMY_LSIG = algosdk.makeLogicSig(new Uint8Array(56), []);

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
