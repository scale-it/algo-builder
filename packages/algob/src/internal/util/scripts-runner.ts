import debug from "debug";
import * as path from "path";

import { BuilderError, ERRORS } from "../../internal/core/errors";
import { AlgobDeployer, AlgobRuntimeEnv } from "../../types";

const log = debug("algob:core:scripts-runner");

async function loadScript (relativeScriptPath: string): Promise<any> {
  const absoluteScriptPath = path.join(process.cwd(), relativeScriptPath);
  try {
    return require(absoluteScriptPath);
  } catch (err) {
    throw new BuilderError(ERRORS.GENERAL.SCRIPT_LOAD_ERROR, {
      script: absoluteScriptPath,
      error: err.message
    });
  }
}

export async function runScript (
  relativeScriptPath: string,
  runtimeEnv: AlgobRuntimeEnv,
  maybeDeployer?: AlgobDeployer
): Promise<void> {
  log(`Running ${relativeScriptPath}.default()`);
  const requiredScript = await loadScript(relativeScriptPath);
  if (!requiredScript.default) {
    throw new BuilderError(ERRORS.GENERAL.NO_DEFAULT_EXPORT_IN_SCRIPT, {
      script: relativeScriptPath
    });
  }
  try {
    await requiredScript.default(
      runtimeEnv,
      runtimeEnv.network.config.accounts,
      maybeDeployer
    );
  } catch (error) {
    if (error instanceof BuilderError) {
      throw error;
    }
    throw new BuilderError(
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR, {
        script: relativeScriptPath,
        error: error.message
      },
      error
    );
  }
}

/**
 * Ensure algob/register source file path is resolved to compiled JS file
 * instead of TS source file, so we don't need to run ts-node unnecessarily.
 */
export function resolveBuilderRegisterPath (): string {
  const algobCoreBaseDir = path.join(__dirname, "..", "..", "..");

  return path.join(
    algobCoreBaseDir,
    "build/register.js"
  );
}
