import { getPathFromDirRecursive } from "@algo-builder/runtime";
import fs from "fs-extra";
import path from "path";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { ASSETS_DIR } from "../internal/core/project-structure";

function normalizePaths (mainPath: string, paths: string[]): string[] {
  return paths.map(n => path.relative(mainPath, n));
}

export function assertDirChildren (dir: string, scriptNames: string[]): string[] {
  const normalized = normalizePaths(".", scriptNames);
  const nonScriptPaths = normalized
    .filter(scriptName => !path.relative(".", scriptName).startsWith(dir));
  if (nonScriptPaths.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY, {
      scripts: nonScriptPaths
    });
  }
  return normalized;
}

export function assertDirectDirChildren (dir: string, scriptNames: string[]): string[] {
  const normalized = normalizePaths(".", scriptNames);
  const badPaths = normalized.filter(scriptName => path.dirname(scriptName) !== dir);
  if (badPaths.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOY_SCRIPT_NON_DIRECT_CHILD, {
      scripts: badPaths
    });
  }
  return normalized;
}

/**
 * This function reads raw signed txn from file /assets/<filename.ext>
 * and returns the encoded txn as Uint8array
 * @param fileName : file name
 * @returns signed transaction encoded as Uint8array
 */
export function loadSignedTxnFromFile (fileName: string): Uint8Array | undefined {
  try {
    const p = getPathFromDirRecursive(ASSETS_DIR, fileName) as string;
    const buffer = fs.readFileSync(p);
    return Uint8Array.from(buffer);
  } catch (e) {
    if (e?.errno === -2) return undefined; // handling a not existing file
    throw e;
  }
}
