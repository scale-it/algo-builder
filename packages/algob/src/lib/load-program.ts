import { getPathFromDirRecursive } from "@algo-builder/runtime";
import fs from "fs";
import YAML from "yaml";

import { ASSETS_DIR } from "../internal/core/project-structure";
import { CompileOp, PyCompileOp, pyExt, tealExt } from "./compile";
import { mockAlgod } from "./constants";

/**
 * returns program TEAL code.
 * @param fileName filename in /assets. Must end with .teal OR .py
 * @param scInitParam smart contract template parameters, used to set hardcoded values in .py smart contract.
 * (used only when compiling PyTEAL to TEAL)
 */
export function getProgram (fileName: string, scInitParam?: unknown): string {
  const filePath = getPathFromDirRecursive(ASSETS_DIR, fileName) as string;
  const program = fs.readFileSync(filePath, 'utf8');

  if (!fileName.endsWith(pyExt) && !fileName.endsWith(tealExt)) {
    throw new Error(`filename "${fileName}" must end with "${tealExt}" or "${pyExt}"`);
  }

  if (fileName.endsWith(pyExt)) {
    // convert initial parameters
    let param: string | undefined = YAML.stringify(scInitParam);
    if (scInitParam === undefined) { param = undefined; }

    const py = new PyCompileOp(new CompileOp(mockAlgod));
    return py.compilePyTeal(fileName, param);
  }
  return program;
}
