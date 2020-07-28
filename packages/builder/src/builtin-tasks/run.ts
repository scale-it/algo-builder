import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScript } from "../internal/util/scripts-runner";
import { checkRelativePaths } from "../lib/files";
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
  runScriptFn: (
    relativeScriptPath: string,
    runtimeEnv: AlgobRuntimeEnv
  ) => Promise<void>): Promise<void> {
  for (let i = 0; i < scriptNames.length; i++) {
    const scriptLocation = scriptNames[i];
    await runScriptFn(scriptLocation, runtimeEnv);
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

  return await runMultipleScripts(runtimeEnv, checkRelativePaths(scripts), async (
    relativeScriptPath: string,
    runtimeEnv: AlgobRuntimeEnv
  ) => {
    log(`Running script ${relativeScriptPath}`);
    await runScript(relativeScriptPath, runtimeEnv);
  });
}

export default function (): void {
  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addVariadicPositionalParam(
      "scripts",
      "A js file to be run within builder's environment"
    )
    .setAction(doRun);
}
