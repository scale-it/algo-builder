import { mkAccountIndex } from "../../lib/account";
import { AlgoOperator } from "../../lib/algo-operator";
import { loadASAFile } from "../../lib/asa";
import { loadCheckpointsRecursive } from "../../lib/script-checkpoints";
import type {
  Accounts,
  AlgobDeployer,
  AlgobRuntimeEnv,
  ASADefs,
  CheckpointRepo
} from "../../types";
import {
  DeployerDeployMode,
  DeployerRunMode
} from "../deployer";
import { txWriter, TxWriterImpl } from "../tx-log-writer";

export interface DeployerConfig {
  runtimeEnv: AlgobRuntimeEnv
  cpData: CheckpointRepo
  asaDefs: ASADefs
  algoOp: AlgoOperator
  accounts: Accounts
  txWriter: txWriter
}

export function mkDeployer (
  allowWrite: boolean,
  deployerConfig: DeployerConfig
): AlgobDeployer {
  if (allowWrite) {
    return new DeployerDeployMode(
      deployerConfig.runtimeEnv,
      deployerConfig.cpData,
      deployerConfig.asaDefs,
      deployerConfig.algoOp,
      deployerConfig.accounts,
      deployerConfig.txWriter);
  }
  return new DeployerRunMode(
    deployerConfig.runtimeEnv,
    deployerConfig.cpData,
    deployerConfig.asaDefs,
    deployerConfig.algoOp,
    deployerConfig.accounts,
    deployerConfig.txWriter);
}

// intialize deployer config obj
export class MkDeployerConfig implements DeployerConfig {
  runtimeEnv: AlgobRuntimeEnv;
  cpData: CheckpointRepo;
  asaDefs: ASADefs;
  algoOp: AlgoOperator;
  txWriter: txWriter;
  accounts: Accounts;

  constructor (
    runtimeEnv: AlgobRuntimeEnv,
    algoOp: AlgoOperator
  ) {
    this.runtimeEnv = runtimeEnv;
    this.cpData = loadCheckpointsRecursive();
    this.algoOp = algoOp;
    this.accounts = mkAccountIndex(runtimeEnv.network.config.accounts); ;
    this.txWriter = new TxWriterImpl('');
    this.asaDefs = loadASAFile(this.accounts);
  }
}
