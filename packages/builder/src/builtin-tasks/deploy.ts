import debug from "debug";
import fsExtra from "fs-extra";
import path from "path";
import fs from "fs";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScriptWithAlgob } from "../internal/util/scripts-runner";
import { TASK_DEPLOY } from "./task-names";
import { getSortedScripts } from "./util";
import { RuntimeArgs, AlgobRuntimeEnv } from "../types";
import { runSingleScript } from "./run";

type TaskArguments = {
  fileNames: string[];
}

const scriptsDirectory = "scripts";

async function loadScriptsFromDir(directory: string): Promise<string[]> {
  if (!fs.existsSync(directory)) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND, {
      directory,
    });
  }
  return getSortedScripts(path.join(directory, "*.js"))
}

async function doDeploy(
  { fileNames }: TaskArguments,
  { run, runtimeArgs }: AlgobRuntimeEnv
) {
  const log = debug("builder:core:tasks:deploy");

  const scriptNames = fileNames.length === 0
    ? await loadScriptsFromDir(scriptsDirectory)
    : fileNames

  if (scriptNames.length === 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND, {
      directory: scriptsDirectory,
    });
  }

  for(let i = 0; i < scriptNames.length; i++){
    const scriptFileName = scriptNames[i]
    const exitCode = await runSingleScript(runtimeArgs, scriptFileName, log)
    if (exitCode !== 0) {
      throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOY_ERROR, {
        script: scriptFileName,
        errorStatus: exitCode,
      });
    }
  }
}

export default function () : void {
  task(TASK_DEPLOY, "Compiles and runs user-defined scripts from scripts directory")
    .addOptionalVariadicPositionalParam(
      "fileNames",
      "A directory that contains js files to be run within builder's environment",
      []
    )
    .setAction(doDeploy);
}
