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
        */

        // TODO: After refactoring script loading workflow the REPL
        // has to be started by reusing the current process
        throw new Error("Console is not supported");
      }
    );
}
