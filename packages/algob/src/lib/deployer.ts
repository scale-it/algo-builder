import { txWriter, TxWriterImpl } from "../internal/tx-log-writer";
import { mkAccountIndex } from "../lib/account";
import { AlgoOperator } from "../lib/algo-operator";
import { loadASAFile } from "../lib/asa";
import type {
  Accounts,
  AlgobRuntimeEnv,
  ASADefs,
  CheckpointRepo,
  DeployerConfig
} from "../types";
import { loadCheckpointsRecursive } from "./script-checkpoints";

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
