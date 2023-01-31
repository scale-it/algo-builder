import { BuilderError, ERRORS } from "@algo-builder/web";
import { exec, execSync, spawnSync, SpawnSyncReturns } from "child_process";
import YAML from "yaml";

import type { ReplaceParams, SCParams } from "../types";
import { PythonCommand, PythonCommands, searchStrCommand } from "./constants";
import { getPathFromDirRecursive } from "./files";
import Os from "os";

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
		// check if pyteal module installed or not
		this.validatePythonModule("pyteal");

		const [replaceParams, param] = this.parseScTmplParam(scTmplParams, logs);
		let content = this.compilePyTeal(filename, param);
		if (YAML.stringify({}) !== YAML.stringify(replaceParams)) {
			content = this.replaceTempValues(content, replaceParams);
		}

		return content;
	}

	/**
	 * Description: Check if current OS is Windows
	 */
	private isWindows(): boolean {
		return Os.platform() === "win32";
	}

	/**
	 * Description: Returns the command to search strings according to OS
	 */
	private getSearchStrCommand(): searchStrCommand {
		return this.isWindows() ? searchStrCommand.Windows : searchStrCommand.UnixLinux;
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
	 * Description: Check and returns the executable python command
	 */
	private getPythonCommand(): PythonCommand {
		const pyCommand = PythonCommands.find((command: PythonCommand) => {
			try {
				execSync(command + " -V", { stdio: "pipe" });
			} catch {
				return false;
			}
			return command;
		});
		if (!pyCommand) {
			throw new Error(`executable python command not found.`);
		}
		return pyCommand;
	}

	/**
	 * Description: Runs a subprocess to execute python script
	 * @param filename : python filename in assets folder
	 * @param scInitParam : Smart contract initialization parameters.
	 */
	private runPythonScript(filename: string, scInitParam?: string): SpawnSyncReturns<string> {
		const filePath = getPathFromDirRecursive(ASSETS_DIR, filename) as string;
		const pythonCommand = this.getPythonCommand();
		// used spawnSync instead of spawn, as it is synchronous
		if (scInitParam === undefined) {
			return spawnSync(pythonCommand, [filePath], { encoding: "utf8" });
		}

		return spawnSync(pythonCommand, [filePath, scInitParam], { encoding: "utf8" });
	}

	/**
	 * Description: This method checks if given module is installed or not. Otherwise throw an exception.
	 * @param module: Module to be checked if installed or not.
	 */
	private validatePythonModule(module: string) {
		const searchStrCommand = this.getSearchStrCommand();
		exec(`pip list | ${searchStrCommand} ${module}`, (err: any) => {
			if (err) {
				throw new Error(
					`"${module}" module not found. Please try running "pip install ${module}"`
				);
			}
		});
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
