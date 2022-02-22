import { getPathFromDirRecursive, getProgram, loadFromYamlFileSilent, types as rtypes } from "@algo-builder/runtime";
import { tx, types as wtypes } from "@algo-builder/web";
import { decodeSignedTransaction, EncodedSignedTransaction, encodeObj, modelsv2 } from "algosdk";
import { spawn } from "child_process";
import * as fs from 'fs';
import { ensureDirSync } from "fs-extra";
import * as path from 'path';

import { writeToFile } from "../builtin-tasks/gen-accounts";
import { ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { timestampNow } from "../lib/time";
import type { ASCCache, DebuggerContext, Deployer } from "../types";
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
   * Get account state(s) (fetched using account address) for dry run.
   * For eg. app_local_get, app_local_put requires an accounts ledger state to be uploaded.
   * @param txn transaction parameters
   */
  private async getAccountsForDryRun (txn: wtypes.ExecParams): Promise<modelsv2.Account[]> {
    // get addresses of Txn.Accounts (in case of stateful tx params) & Txn.Sender
    const txAccounts = (txn as wtypes.AppCallsParam).accounts ?? []; // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
    const addrs = [...txAccounts, tx.getFromAddress(txn)];

    const accountsForDryRun = [];
    for (const addr of addrs) {
      const accInfo = await this.deployer.algodClient.accountInformation(addr).do();
      if (!accInfo) { continue; }

      const acc = new modelsv2.Account({
        address: accInfo.address,
        amount: accInfo.amount,
        amountWithoutPendingRewards: accInfo['amount-without-pending-rewards'],
        appsLocalState: accInfo['apps-local-state'],
        appsTotalSchema: accInfo['apps-total-schema'],
        assets: accInfo.assets,
        createdApps: accInfo['created-apps'],
        createdAssets: accInfo['created-assets'],
        pendingRewards: accInfo['pending-rewards'],
        rewardBase: accInfo['reward-base'],
        rewards: accInfo.rewards,
        round: accInfo.round,
        status: accInfo.status
      });
      accountsForDryRun.push(acc);
    }
    return accountsForDryRun;
  }

  /**
   * Get application state(s) (fetched by appID) for dry run.
   * For eg. app_global_get, app_global_put requires app state.
   * @param txn transaction parameters
   */
  private async getAppsForDryRun (txn: wtypes.ExecParams): Promise<modelsv2.Application[]> {
    if (!(
      txn.type === wtypes.TransactionType.ClearApp ||
      txn.type === wtypes.TransactionType.CloseApp ||
      txn.type === wtypes.TransactionType.DeleteApp ||
      txn.type === wtypes.TransactionType.UpdateApp ||
      txn.type === wtypes.TransactionType.OptInToApp ||
      txn.type === wtypes.TransactionType.CallApp
    )) {
      return [];
    }

    // maybe txn.foreignApps won't work: https://github.com/algorand/go-algorand/issues/2609
    // this would be required with app_global_get_ex ops (access external contract's state)
    const appIDs = [...(txn.foreignApps ?? []), txn.appID];
    const appsForDryRun = [];
    for (const appID of appIDs) {
      const app = await this.deployer.algodClient.getApplicationByID(appID).do();

      const globalStateSchema = new modelsv2.ApplicationStateSchema(app.params['global-state-schema']['num-uint'], app.params['global-state-schema']['num-byte-slice']);
      const localStateSchema = new modelsv2.ApplicationStateSchema(app.params['local-state-schema']['num-uint'], app.params['local-state-schema']['num-byte-slice']);
      const globalState = (app.params['global-state'] || []).map(({ key, value }: { key: string, value: any }) => (
        new modelsv2.TealKeyValue(key, new modelsv2.TealValue(value.type, value.bytes, value.uint))
      ));

      const appParams = new modelsv2.ApplicationParams({
        approvalProgram: app.params['approval-program'],
        clearStateProgram: app.params['clear-state-program'],
        creator: app.params.creator,
        globalState,
        globalStateSchema,
        localStateSchema,
        extraProgramPages: app.params['extra-program-pages']
      });
      const appForDryRun = new modelsv2.Application(app.id, appParams);
      appsForDryRun.push(appForDryRun);
    }

    return appsForDryRun;
  }

  /**
   * Create dry run request object using SDK transaction(s) from wtypes.ExecParams
   * User can dump the response (using this.dryRunResponse) or start debugger session
   * @returns SDK dryrun request object
   */
  private async createDryRunReq (): Promise<modelsv2.DryrunRequest> {
    let [_, signedTxn] = await makeAndSignTx(this.deployer, this.execParams, new Map());
    if (!Array.isArray(signedTxn)) { signedTxn = [signedTxn]; }

    const encodedSignedTxns: EncodedSignedTransaction[] = [];
    for (const s of signedTxn) {
      const decodedTx = decodeSignedTransaction(s);
      encodedSignedTxns.push({ ...decodedTx, txn: decodedTx.txn.get_obj_for_encoding() });
    }

    // query application and account state and pass them to a debug session
    const execParamsArr = Array.isArray(this.execParams) ? this.execParams : [this.execParams];
    const appsForDryRun: modelsv2.Application[] = [];
    const accountsForDryRun: modelsv2.Account[] = [];
    for (const e of execParamsArr) {
      appsForDryRun.push(...(await this.getAppsForDryRun(e)));
      accountsForDryRun.push(...(await this.getAccountsForDryRun(e)));
    }

    // issue: https://github.com/algorand/js-algorand-sdk/issues/410
    // task: https://www.pivotaltracker.com/story/show/179060295
    return new (modelsv2 as any).DryrunRequest({
      accounts: accountsForDryRun.length > 0 ? accountsForDryRun : undefined,
      apps: appsForDryRun.length > 0 ? appsForDryRun : undefined,
      txns: encodedSignedTxns,
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
  /* eslint-disable sonarjs/cognitive-complexity */
  private getTealDbgParams (debugCtxParams: DebuggerContext, pathToCache: string): string[] {
    const tealdbgArgs = [];

    /* Push path of tealfile to debug. If not passed then debugger will use assembled code by default
     * Supplying the program will allow debugging the "original source" and not the decompiled version. */
    const file = debugCtxParams.tealFile;
    if (file) {
      let pathToFile;
      if (file.endsWith(pyExt)) {
        let tealFromPyTEAL: string | undefined;
        // note: currently tealdbg only accepts "teal" code, so we need to compile pyTEAL to TEAL first
        // issue: https://github.com/algorand/go-algorand/issues/2538
        pathToFile = path.join(CACHE_DIR, 'dryrun', path.parse(file).name + '.' + timestampNow().toString() + tealExt);

        // load pyCache from "artifacts/cache"
        if (fs.existsSync(path.join(CACHE_DIR, file + ".yaml"))) {
          const pathToPyCache = getPathFromDirRecursive(CACHE_DIR, file + ".yaml") as string;
          const pyCache = loadFromYamlFileSilent(pathToPyCache) as ASCCache;
          tealFromPyTEAL = pyCache.tealCode;
        }

        /* Use cached TEAL code if:
         *  + we already have compiled pyteal code in artifacts/cache
         *  + template paramteres (scInitParam) are not passed by user
         * NOTE: if template parameters are passed, recompilation is forced to compile
         * pyTEAL with the passed params (as the generated TEAL code could differ from cache)
         */
        if (tealFromPyTEAL !== undefined && debugCtxParams.scInitParam === undefined) {
          console.info('\x1b[33m%s\x1b[0m', `Using cached TEAL code for ${file}`);
        } else {
          tealFromPyTEAL = getProgram(file, debugCtxParams.scInitParam);
        }
        this.writeFile(pathToFile, tealFromPyTEAL);
      } else {
        pathToFile = getPathFromDirRecursive(ASSETS_DIR, file) as string;
      }

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
    const grpIdx = debugCtxParams.groupIndex;
    if (grpIdx !== undefined) {
      const execParamsArr = Array.isArray(this.execParams) ? this.execParams : [this.execParams];
      if (grpIdx >= execParamsArr.length) {
        throw new Error(`groupIndex(= ${grpIdx}) exceeds transaction group length(= ${execParamsArr.length})`);
      }
      tealdbgArgs.push('--group-index', grpIdx.toString());
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
  protected writeFile (filename: string, content: Uint8Array | string): void {
    ensureDirSync(path.dirname(filename));
    fs.writeFileSync(filename, content);
  }
}
