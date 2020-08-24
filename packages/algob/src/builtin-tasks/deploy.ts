import fs from "fs";
import glob from "glob";
import path from "path";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { cmpStr } from "../lib/comparators";
import { assertDirectDirChildren } from "../lib/files";
import {
  persistCheckpoint,
  scriptsDirectory,
  toCheckpointFileName
} from "../lib/script-checkpoints";
import { AlgobRuntimeEnv, CheckpointRepo } from "../types";
import { runMultipleScripts, runMultipleScriptsOneByOne } from "./run";
import { TASK_DEPLOY } from "./task-names";

export interface TaskArgs {
  fileNames: string[]
  force: boolean
  algoDryRun: boolean
}

export function loadFilenames (directory: string): string[] {
  if (!fs.existsSync(directory)) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND, {
      directory
    });
  }

  return glob.sync(path.join(directory, "*.js")).sort(cmpStr);
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

async function doDeploy (
  { fileNames, force, algoDryRun }: TaskArgs, runtimeEnv: AlgobRuntimeEnv
): Promise<void> {
  const logDebugTag = "algob:tasks:deploy";

  const hasUserProvidedScripts = fileNames.length !== 0;

  const scriptNames = hasUserProvidedScripts
    ? assertDirectDirChildren(scriptsDirectory, fileNames)
    : loadFilenames(scriptsDirectory);

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

  if (hasUserProvidedScripts) {
    return await runMultipleScriptsOneByOne(
      runtimeEnv,
      scriptNames,
      onSuccessFn,
      force,
      logDebugTag,
      true,
      algoDryRun
    );
  } else {
    return await runMultipleScripts(
      runtimeEnv,
      scriptNames,
      onSuccessFn,
      force,
      logDebugTag,
      true,
      algoDryRun
    );
  }
}

export default function (): void {
  task(TASK_DEPLOY, "Compiles and runs user-defined scripts from scripts directory")
    .addFlag("force", "Run the scripts even if checkpoint state already exist (Danger: it will overwrite them).")
    .addFlag("algoDryRun", "Creates checkpoints but doesn't interact with a Node.")
    .addOptionalVariadicPositionalParam(
      "fileNames",
      "A directory that contains js files to be run within algob's environment",
      []
    )
    .setAction(doDeploy);
}
