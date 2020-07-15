import debug from "debug";
import fs from "fs";
import glob from "glob";
import path from "path";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { cmpStr } from "../lib/comparators";
import { AlgobRuntimeEnv } from "../types";
import { runMultipleScripts } from "./run";
import { TASK_DEPLOY } from "./task-names";

export interface TaskArgs {
  fileNames: string[]
}

const scriptsDirectory = "scripts";

export function loadFilenames (directory: string): string[] {
  if (!fs.existsSync(directory)) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND, {
      directory
    });
  }

  const files = glob.sync(path.join(directory, "*.js"));
  return files.sort(cmpStr);
}

async function doDeploy ({ fileNames }: TaskArgs, { runtimeArgs }: AlgobRuntimeEnv): Promise<void> {
  const log = debug("builder:core:tasks:deploy");

  const scriptNames = fileNames.length === 0
    ? loadFilenames(scriptsDirectory)
    : fileNames;

  if (scriptNames.length === 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND, {
      directory: scriptsDirectory
    });
  }

  return await runMultipleScripts(runtimeArgs, scriptNames, log);
}

export default function (): void {
  task(TASK_DEPLOY, "Compiles and runs user-defined scripts from scripts directory")
    .addOptionalVariadicPositionalParam(
      "fileNames",
      "A directory that contains js files to be run within builder's environment",
      []
    )
    .setAction(doDeploy);
}
