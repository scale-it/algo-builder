import { getPathFromDirRecursive, types as rtypes } from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";
import { decodeSignedTransaction, encodeObj, modelsv2 } from "algosdk";
import { spawn } from "child_process";
import * as fs from 'fs';
import { ensureDirSync } from "fs-extra";
import * as path from 'path';

import { writeToFile } from "../builtin-tasks/gen-accounts";
import { ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { timestampNow } from "../lib/time";
import type { DebuggerContext, Deployer } from "../types";
import { makeAndSignTx } from "./tx";

export const tealExt = ".teal";
export const pyExt = ".py";
export const lsigExt = ".lsig";

export class Tealdbg {
  deployer: Deployer;
  execParams: wtypes.ExecParams | wtypes.ExecParams[];

  constructor (deployer: Deployer, execParams: wtypes.ExecParams | wtypes.ExecParams[]) {
    this.deployer = deployer;
    this.execParams = execParams;
  }

  /**
   * Create dry run request object using SDK transaction(s) from wtypes.ExecParams
   * User can dump the response (using this.dryRunResponse) or start debugger session
   * @returns SDK dryrun request object
   */
  private async createDryRunReq (): Promise<modelsv2.DryrunRequest> {
    let [_, signedTxn] = await makeAndSignTx(this.deployer, this.execParams, new Map());
    if (!Array.isArray(signedTxn)) { signedTxn = [signedTxn]; }

    const encodedTxns = signedTxn.map(tx => decodeSignedTransaction(tx));
    return new modelsv2.DryrunRequest({
      txns: encodedTxns,
      sources: undefined
    });
  }

  /**
   * Gets dryrun response in json from the request object
   * Returns a response with disassembly, logic-sig-messages with PASS/REJECT and sig-trace
   * @param outFile name of file to dump the response. Dumped in `assets/<file>`
   * @param force if true, overwrites an existing dryrun response dump
   */
  async dryRunResponse (outFile?: string, force?: boolean): Promise<Object> {
    const dryRunRequest = await this.createDryRunReq();
    const dryRunResponse = await this.deployer.algodClient.dryrun(dryRunRequest).do();
    if (outFile) {
      const outPath = path.join(ASSETS_DIR, outFile);
      await writeToFile(JSON.stringify(dryRunResponse, null, 2), force ?? false, outPath);
    }
    return dryRunResponse;
  }

  /**
   * Start a debugger session using child_process.spawn() using the given args.
   * Kills an existing session first (using killall -9 <process>)
   * @param tealdbgArgs arguments to `tealdbg debug`. Eg. `--mode signature`, `--group-index 0`
   */
  protected async runDebugger (tealdbgArgs: string[]): Promise<boolean> {
    spawn(`killall`, ['-9', 'tealdbg']); // kill existing tealdbg process first

    const childProcess = spawn(`tealdbg`, ['debug', ...tealdbgArgs], {
      stdio: "inherit",
      cwd: process.cwd()
    });
    return await new Promise<boolean>((resolve, reject) => {
      childProcess.once("close", (status) => {
        childProcess.removeAllListeners("error");

        if (status === 0) {
          resolve(true);
          return;
        }

        reject(new Error("script process returned non 0 status"));
      });

      childProcess.once("error", (status) => {
        childProcess.removeAllListeners("close");
        reject(new Error("script process returned non 0 status"));
      });
    });
  }

  /**
   * Sets args to pass to `tealdbg debug` command. Currently supported args are
   * tealFile, mode, groupIndex.
   * @param debugCtxParams args passed by user for debugger session
   * @param pathToCache path to --dryrun-dump (msgpack encoded) present in `/cache/dryrun`
   */
  private getTealDbgParams (debugCtxParams: DebuggerContext, pathToCache: string): string[] {
    const tealdbgArgs = [];

    /* Push path of tealfile to debug. If not passed then debugger will use assembled code by default
     * Supplying the program will allow debugging the "original source" and not the decompiled version. */
    if (debugCtxParams.tealFile) {
      const pathToFile = getPathFromDirRecursive(ASSETS_DIR, debugCtxParams.tealFile) as string;
      tealdbgArgs.push(pathToFile);
    }

    // push path to --dryrun-dump (msgpack encoded) present in `/cache/dryrun`
    tealdbgArgs.push('-d', pathToCache);

    /* Set mode(application/signature) if passed. By default,
     * the debugger scans the program to determine the type of contract. */
    if (debugCtxParams.mode !== undefined) {
      const mode = debugCtxParams.mode === rtypes.ExecutionMode.APPLICATION ? 'application' : 'signature';
      tealdbgArgs.push('--mode', mode);
    }

    // set groupIndex flag if a transaction group is passed in this.wtypes.ExecParams
    if (debugCtxParams.groupIndex) {
      tealdbgArgs.push('--group-index', debugCtxParams.groupIndex.toString());
    }

    return tealdbgArgs;
  }

  /**
   * Runs a debugging session:
   *  + Construct dryrun request using wtypes.ExecParams passed by user
   *  + Set arguments for tealdbg debug
   *  + Run debugger session using child_process.spawn()
   * @param debugCtxParams args passed by user for debugger session
   */
  async run (debugCtxParams?: DebuggerContext): Promise<void> {
    // construct encoded dryrun request using SDK
    const dryRunRequest = await this.createDryRunReq();
    const encodedReq = encodeObj(dryRunRequest.get_obj_for_encoding(true));

    // output the dump in cache/dryrun directory (.msgp file is used as input to teal debugger)
    // similar to 'goal <txns> --dryrun-dump'
    const msgpDumpFileName = 'dump-' + timestampNow().toString() + '.msgp';
    const pathToCache = path.join(CACHE_DIR, 'dryrun', msgpDumpFileName);
    this.writeFile(pathToCache, encodedReq);

    // run tealdbg debug on dryrun-dump using args
    const tealdbgArgs = this.getTealDbgParams(debugCtxParams ?? {}, pathToCache);
    await this.runDebugger(tealdbgArgs);
  }

  // write (dryrun dump) to file in `cache/dryrun`
  writeFile (filename: string, content: Uint8Array): void {
    ensureDirSync(path.dirname(filename));
    fs.writeFileSync(filename, content);
  }
}
