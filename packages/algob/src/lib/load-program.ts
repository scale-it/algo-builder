import fs from "fs";
import path from "path";
import YAML from "yaml";

import { ASSETS_DIR } from "../internal/core/project-structure";
import { CompileOp, PyCompileOp, pyExt, tealExt } from "./compile";
import { mockAlgod } from "./constants";

// takes file name as input and returns program as string
export function getProgram (fileName: string, scInitParam?: unknown): string {
  const filePath = path.join(process.cwd(), ASSETS_DIR, fileName);
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
