import debug from "debug";
import fsExtra from "fs-extra";

// import * as path from "path";
// import * as semver from "semver";
import { task } from "../internal/core/config/config-env";
// import { runScript } from "../internal/util/scripts-runner";
import { AlgobRuntimeEnv } from "../types";
import { TASK_CONSOLE } from "./task-names";

export default function (): void {
  const log = debug("builder:core:tasks:console");

  task(TASK_CONSOLE, "Opens builder console")
    .addFlag("noCompile", "Don't compile before running this task")
    .setAction(
      async (
        { noCompile }: { noCompile: boolean }, // eslint-disable-line
        runtimeEnv: AlgobRuntimeEnv            // eslint-disable-line
      ) => {
        if (!runtimeEnv.config.paths) {
          return;
        }
        const paths = runtimeEnv.config.paths;

        // if (!noCompile) {
        //  await run("compile");
        // }

        await fsExtra.ensureDir(paths.cache);
        // const historyFile = path.join(
        //  paths.cache,
        //  "console-history.txt"
        // );

        // const nodeArgs = [];
        // if (semver.gte(process.version, "10.0.0")) {
        //  nodeArgs.push("--experimental-repl-await");
        // }

        log(
          `Creating a Node REPL subprocess with Builder's register so we can set some Node's flags`
        );

        // TODO: After refactoring script loading workflow the REPL
        // has to be started by reusing the current process
        throw new Error("Console is not supported");
        /// / Running the script "" is like running `node`, so this starts the repl
        // await runScript(runtimeEnv, "", [], nodeArgs, {
        //  NODE_REPL_HISTORY: historyFile,
        // });
      }
    );
}
