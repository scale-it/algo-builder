// TODO: import doesn't work: https://www.pivotaltracker.com/story/show/173671803
// import algosdk from "algosdk";

const algosdk = require("algosdk");  // eslint-disable-line @typescript-eslint/no-var-requires

import { task } from "../internal/core/config/config-env";
import { AlgobRuntimeEnv, HttpNetworkConfig,TaskArguments } from "../types";
import { TASK_NODE_INFO } from "./task-names";

export default function (): void {
  task(TASK_NODE_INFO, "Prints node info and status")
    .setAction(nodeInfo);
}

async function nodeInfo(_taskArgs: TaskArguments, env: AlgobRuntimeEnv) {
  const ncfg = env.network.config as HttpNetworkConfig;
  console.log(ncfg);

  const algocl = new algosdk.Algodv2(ncfg.token, ncfg.host, ncfg.port);
  const st = await algocl.status().do();
  console.log("NETWORK NAME", env.network.name);
  console.log("NODE ADDRESS", env.network.config);
  console.log("NODE STATUS", st);
}
