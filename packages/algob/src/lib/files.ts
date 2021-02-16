import fs from "fs";
import path from "path";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { ASSETS_DIR } from "../internal/core/project-structure";

const txExt = ".tx";

function normalizePaths (mainPath: string, paths: string[]): string[] {
  return paths.map(n => path.relative(mainPath, n));
}

export function assertDirChildren (dir: string, scriptNames: string[]): string[] {
  let normalized = normalizePaths(".", scriptNames);
  const nonScriptPaths = normalized
    .filter(scriptName => !path.relative(".", scriptName).startsWith(dir));
  if (nonScriptPaths.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY, {
      scripts: nonScriptPaths
    });
  }

  normalized = normalized.map(scriptName =>
    scriptName.endsWith('.ts') ? path.join('build', scriptName.split('.ts')[0] + '.js') : scriptName);
  return normalized;
}

export function assertDirectDirChildren (dir: string, scriptNames: string[]): string[] {
  let normalized = normalizePaths(".", scriptNames);
  const badPaths = normalized.filter(scriptName => path.dirname(scriptName) !== dir);
  if (badPaths.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOY_SCRIPT_NON_DIRECT_CHILD, {
      scripts: badPaths
    });
  }
  normalized = normalized.map(scriptName =>
    scriptName.endsWith('.ts') ? path.join('build', scriptName.split('.ts')[0] + '.js') : scriptName);
  return normalized;
}

/**
 * Description: this function reads raw signed txn from file /assets/<filename>.tx
 * and returns the encoded txn as Uint8array
 * @param filename : filename [must have .tx ext]
 * @returns signed transaction encoded as Uint8array
 */
export function loadSignedTxnFromFile (filename: string): Uint8Array | undefined {
  if (!filename.endsWith(txExt)) {
    throw new Error(`filename "${filename}" must end with "${txExt}"`);
  }
  try {
    const p = path.join(ASSETS_DIR, filename);
    const buffer = fs.readFileSync(p);
    return Uint8Array.from(buffer);
  } catch (e) {
    if (e?.errno === -2) return undefined; // handling a not existing file
    throw e;
  }
}
