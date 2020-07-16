import debug from "debug";
import * as path from "path";

import { BuilderError, ERRORS } from "../../internal/core/errors";
import { AlgobRuntimeEnv } from "../../types";

const log = debug("builder:core:scripts-runner");

async function loadScript (relativeScriptPath: string): Promise<any> {
  const absoluteScriptPath = path.join(process.cwd(), relativeScriptPath);
  try {
    return require(absoluteScriptPath);
  } catch (err) {
    throw new BuilderError(ERRORS.GENERAL.SCRIPT_LOAD_ERROR, {
      script: absoluteScriptPath
    });
  }
}

export async function runScript (
  relativeScriptPath: string,
  runtimeArgs: AlgobRuntimeEnv
): Promise<void> {
  log(`Running ${relativeScriptPath}.default()`);
  const requiredScript = await loadScript(relativeScriptPath);
  if (!requiredScript.default) {
    throw new BuilderError(ERRORS.GENERAL.NO_DEFAULT_EXPORT_IN_SCRIPT, {
      script: relativeScriptPath
    });
  }
  try {
    await requiredScript.default(runtimeArgs);
  } catch (error) {
    throw new BuilderError(
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      {
        script: relativeScriptPath,
        error: error.message
      },
      error
    );
  }
}

/**
 * Ensure builder/register source file path is resolved to compiled JS file
 * instead of TS source file, so we don't need to run ts-node unnecessarily.
 */
export function resolveBuilderRegisterPath (): string {
  const builderCoreBaseDir = path.join(__dirname, "..", "..", "..");

  return path.join(
    builderCoreBaseDir,
    "build/register.js"
  );
}
