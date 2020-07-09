import { task } from "../internal/core/config/config-env";
import { createClient } from "../lib/driver";
import { AlgobRuntimeEnv, TaskArguments } from "../types";
import { TASK_NODE_INFO } from "./task-names";

export default function (): void {
  task(TASK_NODE_INFO, "Prints node info and status")
    .setAction(nodeInfo);
}

async function nodeInfo(_taskArgs: TaskArguments, env: AlgobRuntimeEnv) {
  const n = env.network;
  const algocl = createClient(n);
  const st = await algocl.status().do();
  console.log("NETWORK NAME", n.name);
  console.log("NODE ADDRESS", n.config);
  console.log("NODE STATUS", st);
}
