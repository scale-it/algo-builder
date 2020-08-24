import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { runScript } from "../internal/util/scripts-runner";
import {
  AlgoSDKWrapperDryRunImpl,
  AlgoSDKWrapperImpl
} from "../lib/algo-sdk";
import { loadASAFile } from "../lib/asa";
import {
  AlgobDeployerImpl,
  AlgobDeployerReadOnlyImpl
} from "../lib/deployer";
import { createClient } from "../lib/driver";
import { assertDirChildren } from "../lib/files";
import {
  loadCheckpoint,
  loadCheckpointsRecursive,
  lsScriptsDir,
  scriptsDirectory
} from "../lib/script-checkpoints";
import { AlgobDeployer, AlgobRuntimeEnv, CheckpointRepo, Checkpoints } from "../types";
import { TASK_RUN } from "./task-names";

interface Input {
  scripts: string[]
  algoDryRun: boolean
}

function filterNonExistent (scripts: string[]): string[] {
  return scripts.filter(script => !fsExtra.pathExistsSync(script));
}

function mkDeployer (
  runtimeEnv: AlgobRuntimeEnv,
  cpData: CheckpointRepo,
  allowWrite: boolean,
  algoDryRun: boolean
): AlgobDeployer {
  const algoSDKWrapper = algoDryRun
    ? new AlgoSDKWrapperDryRunImpl()
    : new AlgoSDKWrapperImpl(createClient(runtimeEnv.network));
  const deployer = new AlgobDeployerImpl(runtimeEnv, cpData, loadASAFile(), algoSDKWrapper);
  if (allowWrite) {
    return deployer;
  }
  return new AlgobDeployerReadOnlyImpl(deployer);
}

// returns all items before the current one and
// mutates the original array to remove them
export function splitAfter (
  scriptsFromScriptsDir: string[],
  splitAfterScript: string
): string[] {
  for (var i = 0; i < scriptsFromScriptsDir.length; i++) {
    const scriptName = scriptsFromScriptsDir[i];
    if (scriptName === splitAfterScript) {
      return scriptsFromScriptsDir.splice(0, i + 1);
    }
  }
  return scriptsFromScriptsDir.splice(0, scriptsFromScriptsDir.length);
}

function loadCheckpointsIntoCPData (cpData: CheckpointRepo, scriptPaths: string[]): CheckpointRepo {
  return scriptPaths
    .map(loadCheckpoint)
    .reduce(
      (out: CheckpointRepo, checkpoints: Checkpoints) => out.merge(checkpoints),
      cpData);
}

// TODO: Reduce file IO:
// Function only accepts sorted scripts -- only this way it loads the state correctly.
// Optimization: Split the scripts into sorted array chunks and run those chunks
// This will save some disk reads because sub-arrays will be sorted
export async function runMultipleScriptsOneByOne (
  runtimeEnv: AlgobRuntimeEnv,
  scriptNames: string[],
  onSuccessFn: (cpData: CheckpointRepo, relativeScriptPath: string) => void,
  force: boolean,
  logDebugTag: string,
  allowWrite: boolean,
  algoDryRun: boolean): Promise<void> {
  for (const script of scriptNames) {
    await runMultipleScripts(
      runtimeEnv,
      [script],
      onSuccessFn,
      force,
      logDebugTag,
      allowWrite,
      algoDryRun
    );
  }
}

export async function runMultipleScripts (
  runtimeEnv: AlgobRuntimeEnv,
  scriptNames: string[],
  onSuccessFn: (cpData: CheckpointRepo, relativeScriptPath: string) => void,
  force: boolean,
  logTag: string,
  allowWrite: boolean,
  algoDryRun: boolean): Promise<void> {
  const log = debug(logTag);
  const cpData: CheckpointRepo = loadCheckpointsRecursive();
  const deployer: AlgobDeployer = mkDeployer(runtimeEnv, cpData, allowWrite, algoDryRun);

  const scriptsFromScriptsDir: string[] = lsScriptsDir();

  for (let i = 0; i < scriptNames.length; i++) {
    const relativeScriptPath = scriptNames[i];
    const prevScripts = splitAfter(scriptsFromScriptsDir, relativeScriptPath);
    loadCheckpointsIntoCPData(cpData, prevScripts);
    if (prevScripts[prevScripts.length - 1] !== relativeScriptPath) {
      cpData.merge(loadCheckpoint(relativeScriptPath));
    }
    if (!force && cpData.networkExistsInCurrentCP(runtimeEnv.network.name)) {
      log(`Skipping: Checkpoint exists for script ${relativeScriptPath}`);
      return;
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
  { scripts, algoDryRun }: Input,
  runtimeEnv: AlgobRuntimeEnv
): Promise<any> {
  const logDebugTag = "algob:tasks:run";

  const nonExistent = filterNonExistent(scripts);
  if (nonExistent.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND, {
      scripts: nonExistent
    });
  }

  await runMultipleScriptsOneByOne(
    runtimeEnv,
    assertDirChildren(scriptsDirectory, scripts),
    (_cpData: CheckpointRepo, _relativeScriptPath: string) => { },
    true,
    logDebugTag,
    false,
    algoDryRun
  );
}

export default function (): void {
  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addVariadicPositionalParam(
      "scripts",
      "A js file to be run within algob's environment"
    )
    .addFlag("algoDryRun", "Uses checkpoints but doesn't interact with a Node.")
    .setAction(doRun);
}
