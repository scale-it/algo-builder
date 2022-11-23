import { BuilderError, ERRORS } from "@algo-builder/web";
import fs from "fs";

import { task } from "../internal/core/config/config-env";
import { loadFilenames } from "../internal/util/files";
import { AlgoOperator, createAlgoOperator } from "../lib/algo-operator";
import { assertDirectDirChildren } from "../lib/files";
import {
	persistCheckpoint,
	scriptsDirectory,
	toCheckpointFileName,
} from "../lib/script-checkpoints";
import { CheckpointRepo, RuntimeEnv } from "../types";
import { DeployerConfig } from "../internal/deployer_cfg";
import { runScripts } from "./run";
import { TASK_DEPLOY } from "./task-names";

export interface TaskArgs {
	fileNames: string[];
	force: boolean;
}

function clearCheckpointFiles(scriptNames: string[]): void {
	scriptNames.forEach((scriptName) => {
		try {
			// fs.unlink deletes the file
			fs.unlinkSync(toCheckpointFileName(scriptName));
		} catch (e) {
			// ignored
		}
	});
}

export async function executeDeployTask(
	{ fileNames, force }: TaskArgs,
	runtimeEnv: RuntimeEnv,
	algoOp: AlgoOperator
): Promise<void> {
	const logDebugTag = "algob:tasks:deploy";

	const scriptNames =
		fileNames.length === 0
			? loadFilenames(scriptsDirectory)
			: assertDirectDirChildren(scriptsDirectory, fileNames);

	if (scriptNames.length === 0) {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND, {
			directory: scriptsDirectory,
		});
	}

	if (force) {
		clearCheckpointFiles(scriptNames);
	}

	const onSuccessFn = (cpData: CheckpointRepo, relativeScriptPath: string): void => {
		persistCheckpoint(relativeScriptPath, cpData.strippedCP);
	};
	const deployerCfg = new DeployerConfig(runtimeEnv, algoOp);
	return await runScripts(
		runtimeEnv,
		scriptNames,
		[],
		onSuccessFn,
		force,
		logDebugTag,
		true,
		deployerCfg
	);
}

export default function (): void {
	task(TASK_DEPLOY, "Compiles and runs user-defined scripts from scripts directory")
		.addFlag(
			"force",
			"Run the scripts even if checkpoint state already exist (Danger: it will overwrite them)."
		)
		.addOptionalVariadicPositionalParam(
			"fileNames",
			"A directory that contains js files to be run within algob's environment",
			[]
		)
		.setAction((input, env) => executeDeployTask(input, env, createAlgoOperator(env.network)));
}
