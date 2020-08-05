import debug from "debug";
import fs from "fs";
import glob from "glob";
import path from "path";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScript } from "../internal/util/scripts-runner";
import { cmpStr } from "../lib/comparators";
import { checkRelativePaths } from "../lib/files";
import {
  AlgobDeployerImpl,
  CheckpointDataImpl,
  loadCheckpoint,
  persistCheckpoint,
  scriptsDirectory,
  toCheckpointFileName
} from "../lib/script-checkpoints";
import { AlgobDeployer, AlgobRuntimeEnv, CheckpointData, ScriptCheckpoints } from "../types";
import { runMultipleScripts } from "./run";
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

  const files = glob.sync(path.join(directory, "*.js"));
  return files.sort(cmpStr);
}

function clearCheckpointFiles(scriptNames: string[]) {
  for (const scriptName of scriptNames) {
    try {
      fs.unlinkSync(toCheckpointFileName(scriptName))
    } catch (e) {
      // ignored
    }
  }
}

async function doDeploy ({ fileNames, force }: TaskArgs, runtimeEnv: AlgobRuntimeEnv): Promise<void> {
  const debugTag = "builder:core:tasks:deploy";
  const log = debug(debugTag);

  const scriptNames = fileNames.length === 0
    ? loadFilenames(scriptsDirectory)
    : checkRelativePaths(fileNames);

  if (scriptNames.length === 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND, {
      directory: scriptsDirectory
    });
  }

  if (force) {
    clearCheckpointFiles(scriptNames)
  }

  return await runMultipleScripts(
    runtimeEnv,
    scriptNames,
    (cpData: CheckpointData, relativeScriptPath: string) => {
      persistCheckpoint(relativeScriptPath, cpData.strippedCP);
    },
    force,
    debugTag,
    (orig: AlgobDeployer) => orig
  );
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
