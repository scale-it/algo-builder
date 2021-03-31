import debug from "debug";
import * as path from "path";

import { BuilderError, ERRORS, parseAlgorandError } from "../../internal/core/errors";
import { Deployer, RuntimeEnv } from "../../types";

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

/** Returns error line number and position at line attached with path.
 * eg: scripts/2-gold-asc.js => scripts/2-gold-asc.js:Line:11,Position:3
 * @param error Error
 * @param scriptPath relative path to script where error occured
 */
function attachLineNumbertoScriptPath (error: Error | BuilderError | any, scriptPath: string): string {
  const stackTraces = error.stack.split('\n');
  for (const trace of stackTraces) {
    const line = trace?.split(scriptPath.concat(':'))[1]?.slice(0, -1); // extract line number
    if (line) {
      const [lineNo, position] = line.split(':') as [string, string];
      return scriptPath.concat(`:Line:${lineNo},Position:${position}`);
    }
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
  runtimeEnv: RuntimeEnv,
  deployer: Deployer
): Promise<void> {
  // if .ts file is encountered, load from /build/scripts/file.js
  if (relativeScriptPath.endsWith('.ts')) {
    relativeScriptPath = path.join('build', relativeScriptPath.split('.ts')[0] + '.js');
  }

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
