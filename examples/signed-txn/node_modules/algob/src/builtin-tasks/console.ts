// import debug from "debug";

import { task } from "../internal/core/config/config-env";
import { AlgobRuntimeEnv } from "../types";
import { TASK_CONSOLE } from "./task-names";

export default function (): void {
  // const log = debug("algob:core:tasks:console");

  task(TASK_CONSOLE, "Opens algob console")
    .addFlag("noCompile", "Don't compile before running this task")
    .setAction(
      async (
        { noCompile }: { noCompile: boolean },
        runtimeEnv: AlgobRuntimeEnv
      ) => {
        /*
        if (!runtimeEnv.config.paths) {
          return;
        }
        const paths = runtimeEnv.config.paths;

        const nodeArgs = [];
        if (semver.gte(process.version, "10.0.0")) {
          nodeArgs.push("--experimental-repl-await");
        }

        log(
          `Creating a Node REPL subprocess with Buidler's register so we can set some Node's flags`);

        // Running the script "" is like running `node`, so this starts the repl
        // await runScriptWithBuidler(buidlerArguments, "", [], nodeArgs, {
        //   NODE_REPL_HISTORY: historyFile,
        // });
        */

        // TODO: After refactoring script loading workflow the REPL
        // has to be started by reusing the current process
        throw new Error("Console is not supported");
      }
    );
}
