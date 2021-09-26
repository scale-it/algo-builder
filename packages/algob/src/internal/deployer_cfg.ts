import { loadASAFile, types as rtypes } from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";

import { mkAccountIndex } from "../lib/account";
import { AlgoOperator } from "../lib/algo-operator";
import { loadCheckpointsRecursive } from "../lib/script-checkpoints";
import type {
  CheckpointRepo,
  Deployer,
  RuntimeEnv
} from "../types";
import { DeployerDeployMode, DeployerRunMode } from "./deployer";
import { txWriter, TxWriterImpl } from "./tx-log-writer";

export function mkDeployer (
  allowWrite: boolean,
  deployerCfg: DeployerConfig
): Deployer {
  if (allowWrite) {
    return new DeployerDeployMode(deployerCfg);
  }
  return new DeployerRunMode(deployerCfg);
}

// intialize deployer config obj
export class DeployerConfig {
  runtimeEnv: RuntimeEnv;
  cpData: CheckpointRepo;
  asaDefs: wtypes.ASADefs;
  algoOp: AlgoOperator;
  txWriter: txWriter;
  accounts: rtypes.AccountMap;

  constructor (runtimeEnv: RuntimeEnv, algoOp: AlgoOperator) {
    this.runtimeEnv = runtimeEnv;
    this.cpData = loadCheckpointsRecursive();
    this.algoOp = algoOp;
    this.accounts = mkAccountIndex(runtimeEnv.network.config.accounts ?? []);
    this.txWriter = new TxWriterImpl('');
    this.asaDefs = loadASAFile(this.accounts);
  }
}
