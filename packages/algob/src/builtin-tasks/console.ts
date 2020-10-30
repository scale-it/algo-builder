import repl from "repl";
import { runInNewContext } from "vm";

import { task } from "../internal/core/config/config-env";
import { DeployerConfig, mkDeployer } from "../internal/deployer_cfg";
import { isRecoverableError, preprocess } from "../internal/util/console";
import { createAlgoOperator } from "../lib/algo-operator";
import { createClient } from "../lib/driver";
import { AlgobDeployer, AlgobRuntimeEnv } from "../types";
import { TASK_CONSOLE } from "./task-names";

// colorize text to yellow
function colorize (message: string): string {
  return `\x1b[32m${message}\x1b[0m`;
}

function initializeDeployer (runtimeEnv: AlgobRuntimeEnv): AlgobDeployer {
  const algoOp = createAlgoOperator(runtimeEnv.network);
  const deployerCfg = new DeployerConfig(runtimeEnv, algoOp);
  return mkDeployer(
    false,
    deployerCfg
  );
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
