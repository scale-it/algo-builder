import debug from "debug";
import fsExtra from "fs-extra";
import * as path from "path";
import * as semver from "semver";

import { task } from "../internal/core/config/config-env";
import { runScript } from "../internal/util/scripts-runner";
import { TASK_CONSOLE } from "./task-names";
import { AlgobRuntimeEnv } from "../../src/types";

export default function () : void {
  const log = debug("builder:core:tasks:console");

  task(TASK_CONSOLE, "Opens builder console")
    .addFlag("noCompile", "Don't compile before running this task")
    .setAction(
      async (
        { noCompile }: { noCompile: boolean }, // eslint-disable-line
        runtimeEnv: AlgobRuntimeEnv            // eslint-disable-line
      ) => {
        if (!runtimeEnv.config.paths) {
          return
        }
        const paths = runtimeEnv.config.paths

        //if (!noCompile) {
        //  await run("compile");
        //}

        await fsExtra.ensureDir(paths.cache);
        const historyFile = path.join(
          paths.cache,
          "console-history.txt"
        );

        const nodeArgs = [];
        if (semver.gte(process.version, "10.0.0")) {
          nodeArgs.push("--experimental-repl-await");
        }

        log(
          `Creating a Node REPL subprocess with Builder's register so we can set some Node's flags`
        );

        //// Running the script "" is like running `node`, so this starts the repl
        //await runScriptWithAlgob(runtimeArgs, "", [], nodeArgs, {
        //  NODE_REPL_HISTORY: historyFile,
        //});
      }
    );
}
