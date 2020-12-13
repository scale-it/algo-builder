import debug from "debug";
import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  AlgobDeployerImpl,
  AlgobDeployerReadOnlyImpl
} from "../internal/deployer";
import { txWriter, TxWriterImpl } from "../internal/tx-log-writer";
import { partitionByFn } from "../internal/util/lists";
import { runScript } from "../internal/util/scripts-runner";
import { mkAccountIndex } from "../lib/account";
import { AlgoOperator, createAlgoOperator } from "../lib/algo-operator";
import { loadASAFile } from "../lib/asa";
import { cmpStr } from "../lib/comparators";
import { assertDirChildren } from "../lib/files";
import {
  loadCheckpoint,
  loadCheckpointsRecursive,
  lsScriptsDir,
  scriptsDirectory
} from "../lib/script-checkpoints";
import { Accounts, AlgobDeployer, AlgobRuntimeEnv, ASADefs, CheckpointRepo } from "../types";
import { TASK_RUN } from "./task-names";

interface Input {
  scripts: string[]
}

function filterNonExistent (scripts: string[]): string[] {
  return scripts.filter(script => !fsExtra.pathExistsSync(script));
}

function mkDeployer (
  runtimeEnv: AlgobRuntimeEnv,
  cpData: CheckpointRepo,
  allowWrite: boolean,
  algoOp: AlgoOperator,
  asaDefs: ASADefs,
  accounts: Accounts,
  txWriter: txWriter
): AlgobDeployer {
  const deployer = new AlgobDeployerImpl(
    runtimeEnv,
    cpData,
    asaDefs,
    algoOp,
    accounts,
    txWriter);
  if (allowWrite) {
    return deployer;
  }
  return new AlgobDeployerReadOnlyImpl(deployer, txWriter);
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
  var checkpointData = cpData;
  for (const s of scriptPaths) {
    checkpointData = cpData.merge(loadCheckpoint(s), s);
  }
  return checkpointData;
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
  const accounts = mkAccountIndex(runtimeEnv.network.config.accounts);
  const asaDefs = loadASAFile(accounts);
  for (const scripts of partitionIntoSorted(scriptNames)) {
    await runSortedScripts(
      runtimeEnv,
      scripts,
      onSuccessFn,
      force,
      logDebugTag,
      allowWrite,
      algoOp,
      asaDefs,
      accounts
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
  algoOp: AlgoOperator,
  asaDefs: ASADefs,
  accounts: Accounts
): Promise<void> {
  const log = debug(logDebugTag);
  const cpData: CheckpointRepo = loadCheckpointsRecursive();
  const txWriter: txWriter = new TxWriterImpl('');
  const deployer: AlgobDeployer = mkDeployer(
    runtimeEnv,
    cpData,
    allowWrite,
    algoOp,
    asaDefs,
    accounts,
    txWriter);

  const scriptsFromScriptsDir: string[] = lsScriptsDir();

  for (const relativeScriptPath of scriptNames) {
    const prevScripts = splitAfter(scriptsFromScriptsDir, relativeScriptPath);
    loadCheckpointsIntoCPData(cpData, prevScripts);
    if (prevScripts[prevScripts.length - 1] !== relativeScriptPath) {
      cpData.merge(loadCheckpoint(relativeScriptPath), relativeScriptPath);
    }
    if (!force && cpData.networkExistsInCurrentCP(runtimeEnv.network.name)) {
      log(`Skipping: Checkpoint exists for script ${relativeScriptPath}`);
      // '\x1b[33m%s\x1b[0m' this is used for setting the message color to yellow.
      console.warn('\x1b[33m%s\x1b[0m', `Skipping: Checkpoint exists for script ${relativeScriptPath}`);
      continue;
    }
    txWriter.setScriptName(relativeScriptPath);
    log(`Running script ${relativeScriptPath}`);
    await runScript(
      relativeScriptPath,
      runtimeEnv,
      deployer
    );
    onSuccessFn(cpData, relativeScriptPath);
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
