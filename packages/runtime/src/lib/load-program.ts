import fs from "fs";

import { SCParams } from "../types";
import { getPathFromDirRecursive } from "./files";
import { ASSETS_DIR, PyCompileOp, pyExt, tealExt } from "./pycompile-op";

/**
 * returns program TEAL code.
 * @param fileName filename in /assets. Must end with .teal OR .py
 * @param scInitParam smart contract template parameters, used to set hardcoded values in .py smart contract.
 * (used only when compiling PyTEAL to TEAL)
 * @param logs only show logs on console when set as true. By default this value is true
 */
export function getProgram (fileName: string, scInitParam?: SCParams, logs: boolean = true): string {
  const filePath = getPathFromDirRecursive(ASSETS_DIR, fileName) as string;
  const program = fs.readFileSync(filePath, 'utf8');

  if (!fileName.endsWith(pyExt) && !fileName.endsWith(tealExt)) {
    throw new Error(`filename "${fileName}" must end with "${tealExt}" or "${pyExt}"`);
  }

  if (fileName.endsWith(pyExt)) {
    const pyOp = new PyCompileOp();
    return pyOp.ensurePyTEALCompiled(fileName, scInitParam, logs);
  }
  return program;
}
