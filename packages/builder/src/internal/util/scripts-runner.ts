import debug from "debug";
import * as path from "path";

import { RuntimeArgs, AlgobRuntimeEnv } from "../../types";
import { ExecutionMode, getExecutionMode } from "../core/execution-mode";
import { getEnvVariablesMap } from "../core/params/env-variables";
import { BuilderError, ERRORS } from "../../../src/internal/core/errors";

const log = debug("builder:core:scripts-runner");

async function loadScript(relativeScriptPath: string): Promise<any> {
  const absoluteScriptPath = path.join(process.cwd(), relativeScriptPath)
  try {
    return await require(absoluteScriptPath)
  } catch (err) {
    throw new BuilderError(ERRORS.GENERAL.SCRIPT_LOAD_ERROR, {
      script: absoluteScriptPath
    });
  }
}

export async function loadAndRunScript(
  relativeScriptPath: string,
  runtimeArgs: AlgobRuntimeEnv
): Promise<number> {
  const requiredScript = await loadScript(relativeScriptPath)
  if (!requiredScript.default) {
    throw new BuilderError(ERRORS.GENERAL.NO_DEFAULT_EXPORT_IN_SCRIPT, {
      script: relativeScriptPath
    });
  }
  try {
    return await requiredScript.default(runtimeArgs) || 0;
  } catch (error) {
    throw new BuilderError(
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      {
        script: relativeScriptPath,
        error: error.message,
      },
      error
    );
  }
}

export async function runScript(
  relativeScriptPath: string,
  runtimeArgs: AlgobRuntimeEnv
): Promise<any> {
  log(`Running ${relativeScriptPath}.default()`);

  const exitCode = await loadAndRunScript(
    relativeScriptPath,
    runtimeArgs
  );
  process.exitCode = exitCode
  if (exitCode !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPT_NON_ZERO_RETURN_STATUS, {
      script: relativeScriptPath,
      errorStatus: exitCode,
    });
  }
}

/**
 * Ensure builder/register source file path is resolved to compiled JS file
 * instead of TS source file, so we don't need to run ts-node unnecessarily.
 */
export function resolveBuilderRegisterPath(): string {
  const builderCoreBaseDir = path.join(__dirname, "..", "..", "..");

  return path.join(
    builderCoreBaseDir,
    "build/register.js"
  );
}
