import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScript } from "../internal/util/scripts-runner";
import {
  appendEnv,
  loadCheckpoint,
  persistCheckpoint
} from "../internal/util/script-checkpoints";
import { AlgobRuntimeEnv } from "../types";
import { TASK_RUN } from "./task-names";

interface Input {
  scripts: string[]
}

function filterNonExistent (scripts: string[]): string[] {
  return scripts.filter(script => !fsExtra.pathExistsSync(script));
}

export async function runMultipleScripts (runtimeEnv: AlgobRuntimeEnv,
                                          scriptNames: string[],
                                          log: (...args: unknown[]) => unknown,
                                          persistSnapshots: boolean,
                                          forceRun: boolean): Promise<void> {
  for (let i = 0; i < scriptNames.length; i++) {
    const scriptLocation = scriptNames[i];
    const currentCP = loadCheckpoint(scriptLocation)
    if (!forceRun && persistSnapshots && currentCP[runtimeEnv.network.name]) {
      log(`Skipping: Checkpoint exists for script ${scriptLocation}`);
      continue;
    }
    log(`Running script ${scriptLocation}`);
    await runScript(
      scriptLocation,
      runtimeEnv
    );
    if (persistSnapshots) {
      persistCheckpoint(
        scriptLocation,
        appendEnv(
          currentCP,
          runtimeEnv))
    }
  }
}

async function doRun (
  { scripts }: Input,
  runtimeEnv: AlgobRuntimeEnv
): Promise<any> {
  const log = debug("builder:core:tasks:run");

  const nonExistent = filterNonExistent(scripts);
  if (nonExistent.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND, {
      scripts: nonExistent
    });
  }

  return await runMultipleScripts(runtimeEnv, scripts, log, false, false);
}

export default function (): void {
  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addVariadicPositionalParam(
      "scripts",
      "A js file to be run within builder's environment"
    )
    .setAction(doRun);
}
