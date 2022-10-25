import { loadASAFile, types as rtypes } from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";
import { Indexer } from "algosdk";

import { mkAccountIndex } from "../lib/account";
import { AlgoOperator } from "../lib/algo-operator";
import { createIndexerClient } from "../lib/driver";
import { loadCheckpointsRecursive } from "../lib/script-checkpoints";
import type { CheckpointRepo, Deployer, RuntimeEnv } from "../types";
import { DeployerDeployMode, DeployerRunMode } from "./deployer";
import { txWriter, TxWriterImpl } from "./tx-log-writer";

export function mkDeployer(allowWrite: boolean, deployerCfg: DeployerConfig): Deployer {
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
	indexerClient: Indexer | undefined;
	txWriter: txWriter;
	accounts: rtypes.AccountMap;
	assetPath: string;

	constructor(runtimeEnv: RuntimeEnv, algoOp: AlgoOperator) {
		this.runtimeEnv = runtimeEnv;
		this.cpData = loadCheckpointsRecursive();
		this.algoOp = algoOp;
		this.accounts = mkAccountIndex(runtimeEnv.network.config.accounts ?? []);
		const assetpath = runtimeEnv.network.config.paths?.assets;
		this.assetPath = assetpath == undefined ? "assets" : assetpath;
		this.txWriter = new TxWriterImpl("");
		this.asaDefs = loadASAFile(this.accounts);
		this.indexerClient = createIndexerClient(runtimeEnv.network.config.indexerCfg);
	}
}
