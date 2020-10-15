/* eslint @typescript-eslint/no-var-requires: "off" */
import algosdk from "algosdk";

import { ASCCache } from "../types";
import { CompileOp } from "./compile";
export const logicsig = require("algosdk/src/logicsig");
/* export class LogicSig {
  tag: any;
  logic: any;
  args: any;
  sig: any;
  msig: any;
  constructor(program: Uint8Array, args: Object) {
    this.tag = undefined;
    this.logic = undefined;
    this.args = undefined;
    this.sig = undefined;
    this.msig = undefined;
  }

  get_obj_for_encoding(): any {
    throw new Error("Not implemented");
  }
  from_obj_for_encoding(encoded: any): any {
    throw new Error("Not implemented");
  }
  verify(publicKey: any): any {
    throw new Error("Not implemented");
  }
  address(): any {
    throw new Error("Not implemented");
  }
  sign(secretKey: any, msig: any): any {
    throw new Error("Not implemented");
  }
  appendToMultisig(secretKey: any): any {
    throw new Error("Not implemented");
  }
  signProgram(secretKey: any): any {
    throw new Error("Not implemented");
  }
  singleSignMultisig(secretKey: any, msig: any): any {
    throw new Error("Not implemented");
  }
  toByte(): any {
    throw new Error("Not implemented");
  }
  fromByte(encoded: any): any {
    throw new Error("Not implemented");
  }
} */

export async function getLsig (name: string, scParams: Object, algodClient: algosdk.Algodv2): Promise<any> {
  const compileOp = new CompileOp(algodClient);
  const result: ASCCache = await compileOp.ensureCompiled(name, false);
  const program = new Uint8Array(Buffer.from(result.compiled, "base64"));
  return algosdk.makeLogicSig(program, scParams);
}
