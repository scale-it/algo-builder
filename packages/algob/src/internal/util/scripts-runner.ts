import debug from "debug";
import * as path from "path";

import { BuilderError, ERRORS, parseAlgorandError } from "../../internal/core/errors";
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

// returns error line number with path. eg: scripts/2-gold-asc.js => scripts/2-gold-asc.js:11:3
function attachLineNumbertoScriptPath (error: Error | BuilderError | any, scriptPath: string): string {
  const stackTraces = error.stack.split('\n');
  for (const trace of stackTraces) {
    const line = trace?.split(scriptPath)[1]?.slice(0, -1); // extract line number
    if (line) { return scriptPath.concat(line); }
  }
  return scriptPath;
}

function displayErr (error: Error | BuilderError | any, relativeScriptPath: string): void {
  if (error instanceof BuilderError) {
    throw error;
  }
  const relativeScriptPathWithLine = attachLineNumbertoScriptPath(error, relativeScriptPath);

  const maybeWrappedError = parseAlgorandError(error, { scriptPath: relativeScriptPathWithLine });
  if (maybeWrappedError instanceof BuilderError) {
    throw maybeWrappedError;
  }
  throw new BuilderError(
    ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR, {
      script: relativeScriptPathWithLine,
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
    await requiredScript.default(runtimeEnv, deployer);
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
