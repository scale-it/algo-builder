import fs from "fs";
import glob from "glob";
import path from "path";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { cmpStr } from "../lib/comparators";
import { checkRelativePaths } from "../lib/files";
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

async function doDeploy ({ fileNames, force }: TaskArgs, runtimeEnv: AlgobRuntimeEnv): Promise<void> {
  const logDebugTag = "algob:tasks:deploy";

  const scriptNames = fileNames.length === 0
    ? loadFilenames(scriptsDirectory)
    : checkRelativePaths(fileNames);

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

  if (fileNames.length === 0) {
    return await runMultipleScriptsOneByOne(
      runtimeEnv,
      scriptNames,
      onSuccessFn,
      force,
      logDebugTag,
      true
    );
  } else {
    return await runMultipleScripts(
      runtimeEnv,
      scriptNames,
      onSuccessFn,
      force,
      logDebugTag,
      true
    );
  }
}

export default function (): void {
  task(TASK_DEPLOY, "Compiles and runs user-defined scripts from scripts directory")
    .addFlag("force", "Run the scripts even if checkpoint state already exist (Danger: it will overwrite them).")
    .addOptionalVariadicPositionalParam(
      "fileNames",
      "A directory that contains js files to be run within builder's environment",
      []
    )
    .setAction(doDeploy);
}
