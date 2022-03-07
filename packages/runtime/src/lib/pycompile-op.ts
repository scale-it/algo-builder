import { BuilderError, ERRORS } from "@algo-builder/web";
import { spawnSync, SpawnSyncReturns } from "child_process";
import YAML from "yaml";

import type { ReplaceParams, SCParams } from "../types";
import { getPathFromDirRecursive } from "./files";

export const tealExt = ".teal";
export const pyExt = ".py";
export const ASSETS_DIR = "assets";

export class PyCompileOp {
	/**
	 * Returns TEAL code from pyteal file (pyTEAL --> TEAL)
	 * @param filename : name of the PyTeal code in `/assets` directory.
	 *                   Examples : [ gold.py, asa.py]
	 *                   MUST have .py extension
	 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 * @param logs only show logs on console when set as true. By default this value is true
	 */
	ensurePyTEALCompiled(filename: string, scTmplParams?: SCParams, logs = true): string {
		if (!filename.endsWith(pyExt)) {
			throw new Error(`filename "${filename}" must end with "${pyExt}"`);
		}

		const [replaceParams, param] = this.parseScTmplParam(scTmplParams, logs);
		let content = this.compilePyTeal(filename, param);
		if (YAML.stringify({}) !== YAML.stringify(replaceParams)) {
			content = this.replaceTempValues(content, replaceParams);
		}

		return content;
	}

	/**
	 * Parses scTmplParams and returns ReplaceParams and stringify object
	 * @param scTmplParams smart contract template parameters
	 * @param logs only show logs on console when set as true. By default this value is true
	 */
	parseScTmplParam(scTmplParams?: SCParams, logs = true): [ReplaceParams, string | undefined] {
		let param: string | undefined;
		const replaceParams: ReplaceParams = {};
		if (scTmplParams === undefined) {
			param = undefined;
		} else {
			const tmp: SCParams = {};
			for (const key in scTmplParams) {
				if (key.startsWith("TMPL_") || key.startsWith("tmpl_")) {
					replaceParams[key] = scTmplParams[key].toString();
				} else {
					tmp[key] = scTmplParams[key];
				}
			}
			if (logs) {
				console.log("PyTEAL template parameters:", tmp);
			}
			param = YAML.stringify(tmp);
		}
		if (logs) {
			console.log("TEAL replacement parameters:", replaceParams);
		}

		return [replaceParams, param];
	}

	/**
	 * Replaces keys with the values in program using replaceParams
	 * @param program Teal program in string
	 * @param replaceParams params that needs to be replaced in program
	 */
	replaceTempValues(program: string, replaceParams: ReplaceParams): string {
		for (const param in replaceParams) {
			program = program.split(param).join(replaceParams[param]);
		}
		return program;
	}

	/**
	 * Description: Runs a subprocess to execute python script
	 * @param filename : python filename in assets folder
	 * @param scInitParam : Smart contract initialization parameters.
	 */
	private runPythonScript(filename: string, scInitParam?: string): SpawnSyncReturns<string> {
		const filePath = getPathFromDirRecursive(ASSETS_DIR, filename) as string;
		// used spawnSync instead of spawn, as it is synchronous
		if (scInitParam === undefined) {
			return spawnSync("python3", [filePath], { encoding: "utf8" });
		}

		return spawnSync("python3", [filePath, scInitParam], { encoding: "utf8" });
	}

	/**
	 * Description: returns TEAL code using pyTeal compiler
	 * @param filename : python filename in assets folder
	 * @param scInitParam : Smart contract initialization parameters.
	 */
	compilePyTeal(filename: string, scInitParam?: string): string {
		const subprocess: SpawnSyncReturns<string> = this.runPythonScript(filename, scInitParam);

		if (subprocess.stderr) {
			throw new BuilderError(ERRORS.PyTEAL.PYTEAL_FILE_ERROR, {
				filename: filename,
				reason: subprocess.stderr,
			});
		}
		return subprocess.stdout;
	}
}
