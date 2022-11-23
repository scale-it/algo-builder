import { BuilderError, ERRORS } from "@algo-builder/web";
import chalk from "chalk";
import debug from "debug";
import fsExtra from "fs-extra";
import { task } from "../internal/core/config/config-env";
import { DeployerConfig, mkDeployer } from "../internal/deployer_cfg";
import { TxWriterImpl } from "../internal/tx-log-writer";
import { partitionByFn } from "../internal/util/lists";
import { runScript } from "../internal/util/scripts-runner";
import { AlgoOperator, createAlgoOperator } from "../lib/algo-operator";
import { cmpStr } from "../lib/comparators";
import { assertDirChildren } from "../lib/files";
import {
	loadCheckpoint,
	loadCheckpointsIntoCPData,
	loadCheckpointsRecursive,
	lsScriptsDir,
	scriptsDirectory,
} from "../lib/script-checkpoints";
import { CheckpointRepo, Deployer, RuntimeEnv } from "../types";
import { TASK_RUN } from "./task-names";

interface Input {
	script: string;
	args: string[];
}

export function filterNonExistent(scripts: string[]): string[] {
	return scripts.filter((script) => !fsExtra.pathExistsSync(script));
}

// returns all items before the current one and
// mutates the original array to remove them
export function splitAfter(
	scriptsFromScriptsDir: string[],
	splitAfterScript: string
): string[] {
	for (let i = 0; i < scriptsFromScriptsDir.length; i++) {
		const scriptName = scriptsFromScriptsDir[i];
		if (scriptName === splitAfterScript) {
			return scriptsFromScriptsDir.splice(0, i + 1);
		}
	}
	return scriptsFromScriptsDir.splice(0, scriptsFromScriptsDir.length);
}

/** Partitions an unsorted string list into sorted parts:
		`[1 2 2 3 4 3 4 2 1]` returns `[[1 2 2 3 4] [3 4] [2] [1]]` */
function partitionIntoSorted(unsorted: string[]): string[][] {
	return partitionByFn(
		(a: string, b: string) => cmpStr(a, b) === 1, // split when a > b
		unsorted
	);
}

export async function runMultipleScripts(
	runtimeEnv: RuntimeEnv,
	scriptNames: string[],
	args: string[],
	onSuccessFn: (cpData: CheckpointRepo, relativeScriptPath: string) => void,
	force: boolean,
	logDebugTag: string,
	allowWrite: boolean,
	algoOp: AlgoOperator
): Promise<void> {
	const deployerCfg = new DeployerConfig(runtimeEnv, algoOp);
	for (const scripts of partitionIntoSorted(scriptNames)) {
		await runSortedScripts(
			runtimeEnv,
			scripts,
			args,
			onSuccessFn,
			force,
			logDebugTag,
			allowWrite,
			deployerCfg
		);
	}
}

// Function only accepts sorted scripts -- only this way it loads the state correctly.
async function runScripts(
	runtimeEnv: RuntimeEnv,
	scriptNames: string[],
	args: string[],
	onSuccessFn: (cpData: CheckpointRepo, relativeScriptPath: string) => void,
	force: boolean,
	logDebugTag: string,
	allowWrite: boolean,
	deployerCfg: DeployerConfig
): Promise<void> {
	const log = debug(logDebugTag);
	deployerCfg.cpData = loadCheckpointsRecursive();
	deployerCfg.txWriter = new TxWriterImpl("");
	const deployer: Deployer = mkDeployer(allowWrite, deployerCfg);

	const scriptsFromScriptsDir: string[] = lsScriptsDir();
	for (const relativeScriptPath of scriptNames) {
		const prevScripts = splitAfter(scriptsFromScriptsDir, relativeScriptPath);
		loadCheckpointsIntoCPData(deployerCfg.cpData, prevScripts);
		if (prevScripts[prevScripts.length - 1] !== relativeScriptPath) {
			deployerCfg.cpData.merge(loadCheckpoint(relativeScriptPath), relativeScriptPath);
		}
		if (!force && deployerCfg.cpData.networkExistsInCurrentCP(runtimeEnv.network.name)) {
			log(`Skipping: Checkpoint exists for script ${relativeScriptPath}`);
			// '\x1b[33m%s\x1b[0m' this is used for setting the message color to yellow.
			console.warn(
				chalk.yellowBright(`Skipping: Checkpoint exists for script ${relativeScriptPath}`)
			);
			continue;
		}
		deployerCfg.txWriter.setScriptName(relativeScriptPath);
		log(`Running script ${relativeScriptPath}`);
		await runScript(relativeScriptPath, args, runtimeEnv, deployer);
		onSuccessFn(deployerCfg.cpData, relativeScriptPath);
	}
}

async function executeRunTask(
	{ script, args }: Input,
	runtimeEnv: RuntimeEnv,
	algoOp: AlgoOperator
): Promise<any> {
	const logDebugTag = "algob:tasks:run";
	const nonExistent = filterNonExistent([script]);
	if (nonExistent.length !== 0) {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND, {
			scripts: nonExistent,
		});
	}
	assertDirChildren(scriptsDirectory, [script]);
	const deployerCfg = new DeployerConfig(runtimeEnv, algoOp);
	await runScripts(
		runtimeEnv,
		[script],
		args,
		(_cpData: CheckpointRepo, _relativeScriptPath: string) => { }, // eslint-disable-line @typescript-eslint/no-empty-function
		true,
		logDebugTag,
		false,
		deployerCfg
	);
}

export default function (): void {
	task(TASK_RUN, "Runs a user-defined script after compiling the project")
		.addOptionalParam("script", "A js file to be run within algob's environment.")
		.addOptionalVariadicPositionalParam("args", "Argument list to be passed to in the script.")
		.setAction((input, env) => executeRunTask(input, env, createAlgoOperator(env.network)));
}
