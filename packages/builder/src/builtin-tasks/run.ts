import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScriptWithAlgob } from "../internal/util/scripts-runner";
import { TASK_RUN } from "./task-names";
import { RuntimeArgs } from "../types";

export async function runSingleScript(runtimeArgs: RuntimeArgs,
                                      scriptFileName: string,
                                      log: (...args: any[]) => any): Promise<number> {
  log(`Running script ${scriptFileName} in a subprocess so we can wait for it to complete`);
  try {
    const exitCode = await runScriptWithAlgob(
      runtimeArgs,
      scriptFileName
    );
    process.exitCode = exitCode
    return exitCode
  } catch (error) {
    throw new BuilderError(
      ERRORS.BUILTIN_TASKS.RUN_SCRIPT_ERROR,
      {
        script: scriptFileName,
        error: error.message,
      },
      error
    );
  }
}

export default function () : void {
  const log = debug("builder:core:tasks:run");

  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addPositionalParam(
      "script",
      "A js file to be run within builder's environment"
    )
    .setAction(
      async (
        { script }: { script: string; },
        { run, runtimeArgs }
      ) => {
        if (!(await fsExtra.pathExists(script))) {
          throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILE_NOT_FOUND, {
            script,
          });
        }

        await runSingleScript(runtimeArgs, script, log)
      }
    );
}
