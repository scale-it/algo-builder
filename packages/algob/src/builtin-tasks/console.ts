import repl from "repl";
import { runInNewContext } from "vm";

import { mkDeployer } from "../builtin-tasks/run";
import { task } from "../internal/core/config/config-env";
import { txWriter, TxWriterImpl } from "../internal/tx-log-writer";
import { isRecoverableError, preprocess } from "../internal/util/console";
import { mkAccountIndex } from "../lib/account";
import { createAlgoOperator } from "../lib/algo-operator";
import { loadASAFile } from "../lib/asa";
import { createClient } from "../lib/driver";
import { loadCheckpointsRecursive } from "../lib/script-checkpoints";
import { AlgobDeployer, AlgobRuntimeEnv, CheckpointRepo } from "../types";
import { TASK_CONSOLE } from "./task-names";

// colorize text to yellow
function colorize (message: string): string {
  return `\x1b[32m${message}\x1b[0m`;
}

function initializeDeployer (runtimeEnv: AlgobRuntimeEnv): AlgobDeployer {
  const algoOp = createAlgoOperator(runtimeEnv.network);
  const accounts = mkAccountIndex(runtimeEnv.network.config.accounts);
  const asaDefs = loadASAFile(accounts);

  const cpData: CheckpointRepo = loadCheckpointsRecursive();
  const txWriter: txWriter = new TxWriterImpl('');
  return mkDeployer(
    runtimeEnv,
    cpData,
    false,
    algoOp,
    asaDefs,
    accounts,
    txWriter);
}

// handles top level await by preprocessing input and awaits the output before returning
async function evaluate (code: string, context: object, filename: string,
  callback: (err: Error | null, result?: object) => void): Promise<void> {
  try {
    const result = await runInNewContext(preprocess(code), context);
    callback(null, result);
  } catch (e) {
    if (isRecoverableError(e)) {
      callback(new repl.Recoverable(e));
    } else {
      console.error(e);
      callback(null);
    }
  }
}

async function startConsole (runtimeEnv: AlgobRuntimeEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    console.log(colorize('Welcome to algob console'));
    console.log(colorize('Try typing: config'));

    const server = repl.start({
      prompt: 'algob> ',
      eval: evaluate
    });

    // assign repl context
    server.context.deployer = initializeDeployer(runtimeEnv);
    server.context.algodClient = createClient(runtimeEnv.network);
    server.context.algob = require('algob');
    server.context.algosdk = require('algosdk');

    server.on('exit', () => {
      resolve();
    });
  });
}

export default function (): void {
  task(TASK_CONSOLE, "Opens algob console")
    .addFlag("noCompile", "Don't compile before running this task")
    .setAction(
      async (
        { noCompile }: { noCompile: boolean },
        runtimeEnv: AlgobRuntimeEnv
      ) => {
        if (!runtimeEnv.config.paths) {
          return;
        }
        await startConsole(runtimeEnv);
      }
    );
}
