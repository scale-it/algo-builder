import {
	getPathFromDirRecursive,
	getProgram,
	loadFromYamlFileSilent,
	types as rtypes,
} from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";
import {
	createDryrun,
	decodeSignedTransaction,
	encodeObj,
	modelsv2,
	SignedTransaction,
} from "algosdk";
import { spawn } from "child_process";
import * as fs from "fs";
import { ensureDirSync } from "fs-extra";
import * as path from "path";

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

	constructor(deployer: Deployer, execParams: wtypes.ExecParams | wtypes.ExecParams[]) {
		this.deployer = deployer;
		this.execParams = execParams;
	}

	/**
	 * Create dry run request object using SDK transaction(s) from wtypes.ExecParams
	 * User can dump the response (using this.dryRunResponse) or start debugger session
	 * @returns SDK dryrun request object
	 */
	private async createDryRunReq(): Promise<modelsv2.DryrunRequest> {
		let signedTxn = (await makeAndSignTx(this.deployer, this.execParams, new Map()))[1];
		if (!Array.isArray(signedTxn)) {
			signedTxn = [signedTxn];
		}

		const signedTxns: SignedTransaction[] = [];
		for (const s of signedTxn) {
			const decodedTx = decodeSignedTransaction(s);
			signedTxns.push(decodedTx);
		}

		return await createDryrun({
			client: this.deployer.algodClient,
			txns: signedTxns,
		});
	}

	/**
	 * Gets dryrun response in json from the request object
	 * Returns a response with disassembly, logic-sig-messages with PASS/REJECT and sig-trace
	 * @param outFile name of file to dump the response. Dumped in `assets/<file>`
	 * @param force if true, overwrites an existing dryrun response dump
	 */
	async dryRunResponse(outFile?: string, force?: boolean): Promise<unknown> {
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
	protected async runDebugger(tealdbgArgs: string[]): Promise<boolean> {
		spawn(`killall`, ["-9", "tealdbg"]); // kill existing tealdbg process first

		console.log("--> ", tealdbgArgs);

		const childProcess = spawn(`tealdbg`, ["debug", ...tealdbgArgs], {
			stdio: "inherit",
			cwd: process.cwd(),
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
	private getTealDbgParams(debugCtxParams: DebuggerContext, pathToCache: string): string[] {
		const tealdbgArgs = [];

		/* Push path of tealfile to debug. If not passed then debugger will use assembled code by default
		 * Supplying the program will allow debugging the "original source" and not the decompiled version. */
		const file = debugCtxParams.tealFile;
		if (file) {
			let pathToFile;
			if (file.endsWith(pyExt)) {
				let tealFromPyTEAL: string | undefined;
				// note: currently tealdbg only accepts "teal" code, so we need to compile pyTEAL to
				// TEAL first. issue: https://github.com/algorand/go-algorand/issues/2538
				pathToFile = path.join(
					CACHE_DIR,
					"dryrun",
					path.parse(file).name + "." + timestampNow().toString() + tealExt
				);

				// load pyCache from "artifacts/cache"
				if (fs.existsSync(path.join(CACHE_DIR, file + ".yaml"))) {
					const pathToPyCache = getPathFromDirRecursive(CACHE_DIR, file + ".yaml");
					if (pathToPyCache) {
						const pyCache = loadFromYamlFileSilent(pathToPyCache) as ASCCache;
						tealFromPyTEAL = pyCache.tealCode;
					}
				}

				/* Use cached TEAL code if:
				 *  + We already have compiled pyteal code in artifacts/cache
				 *  + template paramteres (scInitParam) are not passed by user
				 * NOTE: if template parameters are passed, recompilation is forced to compile
				 * pyTEAL with the passed params (as the generated TEAL code could differ from cache)
				 */
				if (tealFromPyTEAL !== undefined && debugCtxParams.scInitParam === undefined) {
					console.info("\x1b[33m%s\x1b[0m", `Using cached TEAL code for ${file}`);
				} else {
					tealFromPyTEAL = getProgram(file, "", debugCtxParams.scInitParam);
				}
				this.writeFile(pathToFile, tealFromPyTEAL);
			} else {
				pathToFile = getPathFromDirRecursive(ASSETS_DIR, file);
			}

			if (pathToFile) {
				tealdbgArgs.push(pathToFile);
			}
		}

		// push path to --dryrun-dump (msgpack encoded) present in `/cache/dryrun`
		tealdbgArgs.push("-d", pathToCache);

		/* Set mode(application/signature) if passed. By default,
		 * the debugger scans the program to determine the type of contract. */
		if (debugCtxParams.mode !== undefined) {
			const mode =
				debugCtxParams.mode === rtypes.ExecutionMode.APPLICATION ? "application" : "signature";
			tealdbgArgs.push("--mode", mode);
		}

		// set groupIndex flag if a transaction group is passed in this.wtypes.ExecParams
		const grpIdx = debugCtxParams.groupIndex;
		if (grpIdx !== undefined) {
			const execParamsArr = Array.isArray(this.execParams)
				? this.execParams
				: [this.execParams];
			if (grpIdx >= execParamsArr.length) {
				throw new Error(
					`groupIndex(= ${grpIdx}) exceeds transaction group length(= ${execParamsArr.length})`
				);
			}
			tealdbgArgs.push("--group-index", grpIdx.toString());
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
	async run(debugCtxParams?: DebuggerContext): Promise<void> {
		// construct encoded dryrun request using SDK
		const dryRunRequest = await this.createDryRunReq();

		/*
			Encoding fails on taking empty arrays ([]), so we need to convert
			to undefined first (hence the type hack). Ideally, the js-sdk type
			for dryrunreq.accounts should be "modelsv2.accounts[] | undefined"
		*/
		if (dryRunRequest.accounts.length === 0) {
			(dryRunRequest as any).accounts = undefined;
		}
		if (dryRunRequest.apps.length === 0) {
			(dryRunRequest as any).apps = undefined;
		}

		const encodedReq = encodeObj(dryRunRequest.get_obj_for_encoding(true));

		// output the dump in cache/dryrun directory (.msgp file is used as input to teal debugger)
		// similar to 'goal <txns> --dryrun-dump'
		const msgpDumpFileName = "dump-" + timestampNow().toString() + ".msgp";
		const pathToCache = path.join(CACHE_DIR, "dryrun", msgpDumpFileName);
		this.writeFile(pathToCache, encodedReq);

		// run tealdbg debug on dryrun-dump using args
		const tealdbgArgs = this.getTealDbgParams(debugCtxParams ?? {}, pathToCache);
		await this.runDebugger(tealdbgArgs);
	}

	// write (dryrun dump) to file in `cache/dryrun`
	protected writeFile(filename: string, content: Uint8Array | string): void {
		ensureDirSync(path.dirname(filename));
		fs.writeFileSync(filename, content);
	}
}
