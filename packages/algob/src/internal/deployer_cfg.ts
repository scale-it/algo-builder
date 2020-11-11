import { mkAccountIndex } from "../lib/account";
import { AlgoOperator } from "../lib/algo-operator";
import { loadASAFile } from "../lib/asa";
import { loadCheckpointsRecursive } from "../lib/script-checkpoints";
import type {
  Accounts,
  AlgobDeployer,
  AlgobRuntimeEnv,
  ASADefs,
  CheckpointRepo
} from "../types";
import { DeployerDeployMode, DeployerRunMode } from "./deployer";
import { txWriter, TxWriterImpl } from "./tx-log-writer";

export function mkDeployer (
  allowWrite: boolean,
  deployerCfg: DeployerConfig
): AlgobDeployer {
  if (allowWrite) {
    return new DeployerDeployMode(deployerCfg);
  }
  return new DeployerRunMode(deployerCfg);
}

// intialize deployer config obj
export class DeployerConfig {
  runtimeEnv: AlgobRuntimeEnv;
  cpData: CheckpointRepo;
  asaDefs: ASADefs;
  algoOp: AlgoOperator;
  txWriter: txWriter;
  accounts: Accounts;

  constructor (runtimeEnv: AlgobRuntimeEnv, algoOp: AlgoOperator) {
    this.runtimeEnv = runtimeEnv;
    this.cpData = loadCheckpointsRecursive();
    this.algoOp = algoOp;
    this.accounts = mkAccountIndex(runtimeEnv.network.config.accounts);
    this.txWriter = new TxWriterImpl('');
    this.asaDefs = loadASAFile(this.accounts);
  }
}
