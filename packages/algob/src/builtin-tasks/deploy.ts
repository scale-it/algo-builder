import fs from "fs";
import glob from "glob";
import path from "path";

import { BuilderError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { task } from "../internal/core/config/config-env";
import { AlgoOperator, createAlgoOperator } from "../lib/algo-operator";
import { cmpStr } from "../lib/comparators";
import { assertDirectDirChildren } from "../lib/files";
import {
  persistCheckpoint,
  scriptsDirectory,
  toCheckpointFileName
} from "../lib/script-checkpoints";
import { CheckpointRepo, RuntimeEnv } from "../types";
import { runMultipleScripts } from "./run";
import { TASK_DEPLOY } from "./task-names";

export interface TaskArgs {
  fileNames: string[]
  force: boolean
}

/**
 * Load .js, .ts files from /scripts (default) directory
 * @param directory directory to load files from
 * @param taskType task type (eg. test)
 * @returns array of paths as string eg. ['scripts/file1.js', 'scripts/file2.js', ..]
 */
export function loadFilenames (directory: string, taskType?: string): string[] {
  if (!fs.existsSync(directory)) {
    if (taskType === "test") {
      throw new BuilderError(ERRORS.BUILTIN_TASKS.TESTS_DIRECTORY_NOT_FOUND, {
        directory
      });
    } else {
      throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND, {
        directory
      });
    }
  }

  return glob.sync(path.join(directory, "*.js"))
    .concat(glob.sync(path.join(directory, "*.ts")))
    .sort(cmpStr);
}

function clearCheckpointFiles (scriptNames: string[]): void {
  scriptNames.forEach(scriptName => {
    try {
      // fs.unlink deletes the file
      fs.unlinkSync(toCheckpointFileName(scriptName));
    } catch (e) {
      // ignored
    }
  });
}

export async function executeDeployTask (
  { fileNames, force }: TaskArgs,
  runtimeEnv: RuntimeEnv,
  algoOp: AlgoOperator
): Promise<void> {
  const logDebugTag = "algob:tasks:deploy";

  const scriptNames = fileNames.length === 0
    ? loadFilenames(scriptsDirectory)
    : assertDirectDirChildren(scriptsDirectory, fileNames);

  if (scriptNames.length === 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND, {
      directory: scriptsDirectory
    });
  }

  if (force) {
    clearCheckpointFiles(scriptNames);
  }

  const onSuccessFn = (cpData: CheckpointRepo, relativeScriptPath: string): void => {
    persistCheckpoint(relativeScriptPath, cpData.strippedCP);
  };

  return await runMultipleScripts(
    runtimeEnv,
    scriptNames,
    onSuccessFn,
    force,
    logDebugTag,
    true,
    algoOp
  );
}

export default function (): void {
  task(TASK_DEPLOY, "Compiles and runs user-defined scripts from scripts directory")
    .addFlag("force", "Run the scripts even if checkpoint state already exist (Danger: it will overwrite them).")
    .addOptionalVariadicPositionalParam(
      "fileNames",
      "A directory that contains js files to be run within algob's environment",
      []
    )
    .setAction((input, env) => executeDeployTask(input, env, createAlgoOperator(env.network)));
}
