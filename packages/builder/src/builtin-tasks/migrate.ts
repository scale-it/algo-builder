import debug from "debug";
import fsExtra from "fs-extra";
import path from "path";
import fs from "fs";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScriptWithAlgob } from "../internal/util/scripts-runner";
import { TASK_MIGRATE } from "./task-names";
import { glob } from "./util";
import { RuntimeArgs, AlgobRuntimeEnv } from "../types";
import { runSingleScript } from "./run";

type TaskArguments = {
  directory: string;
  noCompile: boolean
}

export async function getSortedScriptsNoGlob(
  directory: string,
  globFn: (pattern: string, params?: any) => Promise<string[]>
): Promise<string[]> {
  return (await globFn(directory, {})).sort()
}

export function getSortedScripts(directory: string): Promise<string[]> {
  return getSortedScriptsNoGlob(directory, glob)
}

async function doMigrate(
  { directory, noCompile }: TaskArguments,
  { run, runtimeArgs }: AlgobRuntimeEnv
) {
  const log = debug("builder:core:tasks:migrate");
  if (!fs.existsSync(directory)) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND, {
      directory,
    });
  }

  const scriptNames = await getSortedScripts(path.join(directory, "*.js"))

  if (scriptNames.length == 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND, {
      directory,
    });
  }

  if (!noCompile) {
    throw new Error("MM: compilation is not possible")
    //await run(TASK_COMPILE);
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
  task(TASK_MIGRATE, "Compiles and runs user-defined scripts from scripts directory")
    .addPositionalParam(
      "directory",
      "A directory that contains js files to be run within builder's environment",
      "scripts"
    )
    .addFlag("noCompile", "Don't compile before running this task")
    .setAction(doMigrate);
}
