import debug from "debug";
import fsExtra from "fs-extra";
import path from "path";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScript } from "../internal/util/scripts-runner";
import { checkRelativePaths } from "../lib/files";
import {
  AlgobDeployerImpl,
  AlgobDeployerReadOnlyImpl,
  loadCheckpoint,
  loadCheckpointsRecursive,
  lsScriptsDir
} from "../lib/script-checkpoints";
import { AlgobDeployer, AlgobRuntimeEnv, CheckpointData, ScriptCheckpoints } from "../types";
import { TASK_RUN } from "./task-names";
import { cmpStr } from "../lib/comparators";

interface Input {
  scripts: string[]
}

function filterNonExistent (scripts: string[]): string[] {
  return scripts.filter(script => !fsExtra.pathExistsSync(script));
}

function mkDeployer(
  runtimeEnv: AlgobRuntimeEnv,
  cpData: CheckpointData,
  allowWrite: boolean
): AlgobDeployer {
  const deployer = new AlgobDeployerImpl(runtimeEnv, cpData)
  if (allowWrite) {
    return deployer
  }
  return new AlgobDeployerReadOnlyImpl(deployer)
}

// returns all items before the current one and
// mutates the original array to remove them
export function splitAfter(
  scriptsFromScriptsDir: string[],
  splitAfterScript: string
): string[] {
  for (var i = 0; i < scriptsFromScriptsDir.length; i++) {
    const scriptName = scriptsFromScriptsDir[i]
    if (scriptName === splitAfterScript) {
      return scriptsFromScriptsDir.splice(0, i + 1)
    }
  }
  return scriptsFromScriptsDir.splice(0, scriptsFromScriptsDir.length)
}

function loadCheckpointsIntoCPData(cpData: CheckpointData, scriptPaths: string[]): CheckpointData {
  return scriptPaths
    .map(loadCheckpoint)
    .reduce(
      (out: CheckpointData, checkpoints: ScriptCheckpoints) => out.merge(checkpoints),
      cpData)
}

export async function runMultipleScripts (
  runtimeEnv: AlgobRuntimeEnv,
  scriptNames: string[],
  onSuccessFn: (cpData: CheckpointData, relativeScriptPath: string) => void,
  force: boolean,
  logTag: string,
  allowWrite: boolean): Promise<void> {
  const log = debug(logTag);
  const cpData: CheckpointData = loadCheckpointsRecursive();
  const deployer: AlgobDeployer = mkDeployer(runtimeEnv, cpData, allowWrite)

  const scriptsFromScriptsDir: string[] = lsScriptsDir()
  const sortedScriptNames = scriptNames.map(n => path.relative(".", n)).sort(cmpStr)

  for (let i = 0; i < sortedScriptNames.length; i++) {
    const relativeScriptPath = sortedScriptNames[i];
    const prevScripts = splitAfter(scriptsFromScriptsDir, relativeScriptPath)
    loadCheckpointsIntoCPData(cpData, prevScripts)
    if (prevScripts[prevScripts.length-1] !== relativeScriptPath) {
      cpData.merge(loadCheckpoint(relativeScriptPath));
    }
    if (!force && cpData.networkExistsInCurrentCP(runtimeEnv.network.name)) {
      log(`Skipping: Checkpoint exists for script ${relativeScriptPath}`);
      continue;
    }
    log(`Running script ${relativeScriptPath}`);
    await runScript(
      relativeScriptPath,
      runtimeEnv,
      deployer
    );
    onSuccessFn(cpData, relativeScriptPath);
  }
}

async function doRun (
  { scripts }: Input,
  runtimeEnv: AlgobRuntimeEnv
): Promise<any> {
  const logDebugTag = "builder:core:tasks:run";

  const nonExistent = filterNonExistent(scripts);
  if (nonExistent.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND, {
      scripts: nonExistent
    });
  }

  const onSuccessFn = (cpData: CheckpointData, relativeScriptPath: string) => {}
  const relativePathOnlyScripts = checkRelativePaths(scripts)

  // TODO: Reduce file IO:
  // Scripts have to be sorted to run them through the function.
  // Split the scripts into sorted array chunks and run those chunks
  // This will save some disk reads
  for (const script of relativePathOnlyScripts) {
    await runMultipleScripts(
      runtimeEnv,
      [script],
      onSuccessFn,
      true,
      logDebugTag,
      false
    );
  }
}

export default function (): void {
  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addVariadicPositionalParam(
      "scripts",
      "A js file to be run within builder's environment"
    )
    .setAction(doRun);
}
