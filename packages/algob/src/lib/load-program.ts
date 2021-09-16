import { getPathFromDirRecursive } from "@algo-builder/runtime";
import fs from "fs";
import YAML from "yaml";

import { ASSETS_DIR } from "../internal/core/project-structure";
import { SCParams } from "../types";
import { CompileOp, PyCompileOp, pyExt, tealExt } from "./compile";
import { mockAlgod } from "./constants";

/**
 * returns program TEAL code.
 * @param fileName filename in /assets. Must end with .teal OR .py
 * @param scInitParam smart contract template parameters, used to set hardcoded values in .py smart contract.
 * (used only when compiling PyTEAL to TEAL)
 */
export function getProgram (fileName: string, scInitParam?: SCParams): string {
  const filePath = getPathFromDirRecursive(ASSETS_DIR, fileName) as string;
  const program = fs.readFileSync(filePath, 'utf8');

  if (!fileName.endsWith(pyExt) && !fileName.endsWith(tealExt)) {
    throw new Error(`filename "${fileName}" must end with "${tealExt}" or "${pyExt}"`);
  }

  if (fileName.endsWith(pyExt)) {
    const py = new PyCompileOp(new CompileOp(mockAlgod));
    // convert initial parameters
    const [replaceParams, param] = py.parseScTmplParam(scInitParam);
    let content = py.compilePyTeal(fileName, param);
    if (YAML.stringify({}) !== YAML.stringify(replaceParams)) {
      content = py.replaceTempValues(content, replaceParams);
    }

    return content;
  }
  return program;
}
