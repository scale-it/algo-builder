import { spawnSync, SpawnSyncReturns } from "child_process";
import path from "path";

import { ASSETS_DIR } from "../internal/core/project-structure";

const pythonExt = ".py";

/**
 * Description: Runs a subprocess to execute python script
 * @param filename : python filename in assets folder
 */
function runPythonScript (filename: string): SpawnSyncReturns<string> {
  // used spawnSync instead of spawn, as it is synchronous
  return spawnSync('python3', [
    path.join(ASSETS_DIR, filename)],
  { encoding: 'utf8' }
  );
}

/**
 * Description: returns TEAL code using pyTeal compiler
 * @param filename : python filename in assets folder
 */
export function compilePyTeal (filename: string): string {
  if (!filename.endsWith(pythonExt)) {
    throw new Error(`filename "${filename}" must end with "${pythonExt}"`);
  }
  const subprocess: SpawnSyncReturns<string> = runPythonScript(filename);

  if (subprocess.stderr) {
    console.error(subprocess.stderr);
    throw Error(subprocess.stderr);
  }
  // output TEAL code
  return subprocess.stdout;
}
