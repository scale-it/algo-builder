import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScriptWithBuilder } from "../internal/util/scripts-runner";

import {
  //TASK_COMPILE,
  TASK_RUN
} from "./task-names";

export default function () {
  const log = debug("builder:core:tasks:run");

  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addPositionalParam(
      "script",
      "A js file to be run within builder's environment"
    )
    .addFlag("noCompile", "Don't compile before running this task")
    .setAction(
      async (
        { script, noCompile }: { script: string; noCompile: boolean },
        { run, builderArguments }
      ) => {
        if (!(await fsExtra.pathExists(script))) {
          throw "err"
          //throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILE_NOT_FOUND, {
          //  script,
          //});
        }

        //if (!noCompile) {
        //  await run(TASK_COMPILE);
        //}

        log(`Running script ${script} in a subprocess so we can wait for it to complete`);

        try {
          process.exitCode = await runScriptWithBuilder(
            builderArguments,
            script
          );
        } catch (error) {
          throw "err 2"
          /*
          throw new BuilderError(
            ERRORS.BUILTIN_TASKS.RUN_SCRIPT_ERROR,
            {
              script,
              error: error.message,
            },
            error
          );
          */
        }
      }
    );
}
