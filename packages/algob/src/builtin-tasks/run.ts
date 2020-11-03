import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { DeployerConfig, mkDeployer } from "../internal/deployer_cfg";
import { TxWriterImpl } from "../internal/tx-log-writer";
import { partitionByFn } from "../internal/util/lists";
import { runScript } from "../internal/util/scripts-runner";
import { AlgoOperator, createAlgoOperator } from "../lib/algo-operator";
import { cmpStr } from "../lib/comparators";
import { assertDirChildren } from "../lib/files";
import {
  loadCheckpoint,
  loadCheckpointsIntoCPData,
  loadCheckpointsRecursive,
  lsScriptsDir,
  scriptsDirectory
} from "../lib/script-checkpoints";
import { AlgobDeployer, AlgobRuntimeEnv, CheckpointRepo } from "../types";
import { TASK_RUN } from "./task-names";

interface Input {
  scripts: string[]
}

function filterNonExistent (scripts: string[]): string[] {
  return scripts.filter(script => !fsExtra.pathExistsSync(script));
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

/** Partitions an unsorted string list into sorted parts:
    `[1 2 2 3 4 3 4 2 1]` returns `[[1 2 2 3 4] [3 4] [2] [1]]` */
function partitionIntoSorted (unsorted: string[]): string[][] {
  return partitionByFn(
    (a: string, b: string) => cmpStr(a, b) === 1, // split when a > b
    unsorted);
}

export async function runMultipleScripts (
  runtimeEnv: AlgobRuntimeEnv,
  scriptNames: string[],
  onSuccessFn: (cpData: CheckpointRepo, relativeScriptPath: string) => void,
  force: boolean,
  logDebugTag: string,
  allowWrite: boolean,
  algoOp: AlgoOperator
): Promise<void> {
  const deployerCfg = new DeployerConfig(runtimeEnv, algoOp);
  for (const scripts of partitionIntoSorted(scriptNames)) {
    await runSortedScripts(
      runtimeEnv,
      scripts,
      onSuccessFn,
      force,
      logDebugTag,
      allowWrite,
      deployerCfg
    );
  }
}

// Function only accepts sorted scripts -- only this way it loads the state correctly.
async function runSortedScripts (
  runtimeEnv: AlgobRuntimeEnv,
  scriptNames: string[],
  onSuccessFn: (cpData: CheckpointRepo, relativeScriptPath: string) => void,
  force: boolean,
  logDebugTag: string,
  allowWrite: boolean,
  deployerCfg: DeployerConfig
): Promise<void> {
  const log = debug(logDebugTag);
  deployerCfg.cpData = loadCheckpointsRecursive();
  deployerCfg.txWriter = new TxWriterImpl('');
  const deployer: AlgobDeployer = mkDeployer(
    allowWrite,
    deployerCfg);

  const scriptsFromScriptsDir: string[] = lsScriptsDir();

  for (const relativeScriptPath of scriptNames) {
    const prevScripts = splitAfter(scriptsFromScriptsDir, relativeScriptPath);
    loadCheckpointsIntoCPData(deployerCfg.cpData, prevScripts);
    if (prevScripts[prevScripts.length - 1] !== relativeScriptPath) {
      deployerCfg.cpData.merge(loadCheckpoint(relativeScriptPath), relativeScriptPath);
    }
    if (!force && deployerCfg.cpData.networkExistsInCurrentCP(runtimeEnv.network.name)) {
      log(`Skipping: Checkpoint exists for script ${relativeScriptPath}`);
      // '\x1b[33m%s\x1b[0m' this is used for setting the message color to yellow.
      console.warn('\x1b[33m%s\x1b[0m', `Skipping: Checkpoint exists for script ${relativeScriptPath}`);
      continue;
    }
    deployerCfg.txWriter.setScriptName(relativeScriptPath);
    log(`Running script ${relativeScriptPath}`);
    await runScript(
      relativeScriptPath,
      runtimeEnv,
      deployer
    );
    onSuccessFn(deployerCfg.cpData, relativeScriptPath);
  }
}

async function executeRunTask (
  { scripts }: Input,
  runtimeEnv: AlgobRuntimeEnv,
  algoOp: AlgoOperator
): Promise<any> {
  const logDebugTag = "algob:tasks:run";

  const nonExistent = filterNonExistent(scripts);
  if (nonExistent.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND, {
      scripts: nonExistent
    });
  }

  await runMultipleScripts(
    runtimeEnv,
    assertDirChildren(scriptsDirectory, scripts),
    (_cpData: CheckpointRepo, _relativeScriptPath: string) => { },
    true,
    logDebugTag,
    false,
    algoOp
  );
}

export default function (): void {
  task(TASK_RUN, "Runs a user-defined script after compiling the project")
    .addVariadicPositionalParam(
      "scripts",
      "A js file to be run within algob's environment"
    )
    .setAction((input, env) => executeRunTask(input, env, createAlgoOperator(env.network)));
}
