import fs from "fs-extra";
import path from "path";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { ASSETS_DIR } from "../internal/core/project-structure";

const txExt = ".tx";

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
 * Description: this function reads raw signed txn from file /assets/<filename>.tx
 * and returns the encoded txn as Uint8array
 * @param fileName : fileName [must have .tx ext]
 * @returns signed transaction encoded as Uint8array
 */
export function loadSignedTxnFromFile (fileName: string): Uint8Array | undefined {
  if (!fileName.endsWith(txExt)) {
    throw new Error(`filename "${fileName}" must end with "${txExt}"`);
  }
  try {
    const p = path.join(ASSETS_DIR, fileName);
    const buffer = fs.readFileSync(p);
    return Uint8Array.from(buffer);
  } catch (e) {
    if (e?.errno === -2) return undefined; // handling a not existing file
    throw e;
  }
}

/**
 * Description: This function reads raw signed transaction from file /assets/<filename.ext>
 * and returns the encoded txn as Uint8Array Buffer
 * @param fileName : fileName
 * @returns signed transaction as buffer
 */
export function loadRawSignedTxnFromFile (fileName: string): Buffer | undefined {
  const p = path.join(ASSETS_DIR, fileName);
  const txFile = fs.readFileSync(p);
  if (txFile === undefined) {
    throw new Error(`File ${fileName} does not exist`);
  }
  return txFile;
}

/**
 * Description: This function writes the data to file.
 * @param fileName: Output file name
 * @param data: Data to be written to file
 */
export function writeToFile (fileName: string, data: any): void {
  fs.outputFileSync(fileName, data);
}
