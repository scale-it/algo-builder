import path from "path";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { scriptsDirectory } from "../lib/script-checkpoints";

export function checkRelativePaths (scriptNames: string[]): string[] {
  const nonScriptPaths = [];
  for (let i = 0; i < scriptNames.length; i++) {
    const scriptName = scriptNames[i];
    if (!path.relative(".", scriptName).startsWith(scriptsDirectory)) {
      nonScriptPaths.push(scriptName);
    }
  }
  if (nonScriptPaths.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY, {
      scripts: nonScriptPaths
    });
  }
  return scriptNames;
}
