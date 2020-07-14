import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScriptWithAlgob } from "../internal/util/scripts-runner";
import { AlgobRuntimeEnv,RuntimeArgs } from "../types";
import { TASK_RUN } from "./task-names";

type Input = {
  scripts: string[]
}

function filterNonExistent(scripts: string[]): string[] {
  return scripts.filter(script => !fsExtra.pathExistsSync(script))
}

export function runSingleScript(runtimeArgs: RuntimeArgs,
                                scriptLocation: string): Promise<number> {
  try {
    return runScriptWithAlgob(
      runtimeArgs,
      scriptLocation
    );
  } catch (error) {
    throw new BuilderError(
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      {
        script: scriptLocation,
        error: error.message,
      },
      error
    );
  }
}

export async function runMultipleScripts(runtimeArgs: RuntimeArgs,
                                         scriptNames: string[],
                                         log: (...args: unknown[]) => unknown): Promise<void> {
  for (let i = 0; i < scriptNames.length; i++) {
    const scriptLocation = scriptNames[i]
    log(
      "Running script ${scriptLocation} in a subprocess so we can wait for it to complete"
    );
    const exitCode = await runSingleScript(runtimeArgs, scriptLocation)
    process.exitCode = exitCode
    if (exitCode !== 0) {
      throw new BuilderError(ERRORS.BUILTIN_TASKS.EXECUTION_ERROR, {
        script: scriptLocation,
        errorStatus: exitCode,
      });
    }
  }
}

async function doRun (
  { scripts }: Input,
  { run, runtimeArgs }: AlgobRuntimeEnv
) {
  const log = debug("builder:core:tasks:run");

  const nonExistent = filterNonExistent(scripts)
  if (nonExistent.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND, {
      scripts: nonExistent,
    });
  }

  await runMultipleScripts(runtimeArgs, scripts, log)
}

export default function () : void {
  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addVariadicPositionalParam(
      "scripts",
      "A js file to be run within builder's environment"
    )
    .setAction(doRun);
}
