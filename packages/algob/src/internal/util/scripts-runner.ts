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

export async function runDeployASA (
  relativeYamlPath: string,
  runtimeEnv: AlgobRuntimeEnv,
  deployer: AlgobDeployer): Promise<void> {
}

function displayErr (error: Error | BuilderError | any, relativeScriptPath: string): void {
  if (error instanceof BuilderError) {
    throw error;
  }
  // TX execution error
  if (error.body?.message !== undefined) {
    throw new BuilderError(
      ERRORS.BUILTIN_TASKS.SCRIPT_CHAIN_IO_ERROR, {
        script: relativeScriptPath,
        errorType: error.clientError
          ? "Client"
          : "Server",
        message: error.body?.message
          ? error.body.message
          : error.error.message
      },
      error.error
    );
  }
  throw new BuilderError(
    ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR, {
      script: relativeScriptPath,
      message: error.message
    },
    error
  );
}

export async function runScript (
  relativeScriptPath: string,
  runtimeEnv: AlgobRuntimeEnv,
  deployer: AlgobDeployer
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
      deployer.accounts,
      deployer
    );
  } catch (error) {
    displayErr(error, relativeScriptPath);
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
