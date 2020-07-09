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
import { RuntimeArgs } from "../types";
import { runSingleScript } from "./run";

export default function () : void {
  const log = debug("builder:core:tasks:migrate");

  task(TASK_MIGRATE, "Compiles and runs user-defined scripts from scripts directory")
    .addPositionalParam(
      "directory",
      "A directory that contains js files to be run within builder's environment",
      "scripts"
    )
    .addFlag("noCompile", "Don't compile before running this task")
    .setAction(
      async (
        { directory, noCompile }: { directory: string; noCompile: boolean },
        { run, runtimeArgs }
      ) => {

        if (!fs.existsSync(directory)) {
          throw new BuilderError(ERRORS.BUILTIN_TASKS.MIGRATE_DIRECTORY_NOT_FOUND, {
            directory,
          });
        }

        const scriptNames = await glob(path.join(directory, "*.js"), {})

        if (scriptNames.length == 0) {
          throw new BuilderError(ERRORS.BUILTIN_TASKS.MIGRATE_NO_FILES_FOUND, {
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
            return
          }
        }
      }
    );
}
