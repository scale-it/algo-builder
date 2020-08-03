
import * as fs from "fs";
import path from "path";
import YAML from "yaml";

import {
  AlgobDeployer,
  AlgobRuntimeEnv,
  ScriptCheckpoints,
  ScriptNetCheckpoint,
  AccountDef,
  CheckpointData,
  ASAInfo,
  ASCInfo
} from "../types";
import { DeepReadonly } from "ts-essentials";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";

export const scriptsDirectory = "scripts";
const artifactsPath = "artifacts";

export function toCheckpointFileName (scriptName: string): string {
  return path.join(artifactsPath, scriptName + ".cp.yaml");
}

export class CheckpointDataImpl implements CheckpointData {
	checkpoints: ScriptCheckpoints = {};
	deployedASA: { [assetName: string]: ASAInfo } = {};
	deployedASC: { [assetName: string]: ASCInfo } = {};

  appendToCheckpoint (networkName: string, append: ScriptNetCheckpoint): CheckpointData {
    if (this.checkpoints[networkName]) {
      this.checkpoints[networkName].timestamp = append.timestamp;
      this.checkpoints[networkName].metadata = Object.assign(
        {},
        this.checkpoints[networkName].metadata, append.metadata
      );
      return this;
    }
    this.checkpoints[networkName] = append;
    return this;
  }

  mergeCheckpoints (curr: ScriptCheckpoints): CheckpointData {
    const keys: string[] = Object.keys(curr);
    return keys.reduce((out: CheckpointData, key: string) => {
      return this.appendToCheckpoint(key, curr[key]);
    }, this);
  }

  appendEnv (runtimeEnv: AlgobRuntimeEnv): CheckpointData {
    return this.appendToCheckpoint(runtimeEnv.network.name, createNetCheckpoint());
  }
}

export function createNetCheckpoint (metadata?: {[key: string]: string}): ScriptNetCheckpoint {
  return {
    timestamp: +new Date(),
    metadata: metadata === undefined ? {} : metadata
  };
}

export function persistCheckpoint (scriptName: string, checkpoint: ScriptCheckpoints): void {
  const scriptPath = toCheckpointFileName(scriptName);
  const scriptDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  fs.writeFileSync(
    scriptPath,
    YAML.stringify(checkpoint)
  );
}

export function loadCheckpoint (scriptName: string): ScriptCheckpoints {
  const checkpointPath = toCheckpointFileName(scriptName);
  if (!fs.existsSync(checkpointPath)) {
    return {};
  }
  return YAML.parse(fs.readFileSync(checkpointPath).toString());
}

export class AlgobDeployerImpl implements AlgobDeployer {
  private readonly runtimeEnv: AlgobRuntimeEnv;
  private readonly cpData: CheckpointData;

  constructor (runtimeEnv: AlgobRuntimeEnv, cpData: CheckpointData) {
    this.runtimeEnv = runtimeEnv;
    this.cpData = cpData.appendEnv(runtimeEnv);
  }

  get accounts(): AccountDef[] | undefined {
    return this.runtimeEnv.network.config.accounts;
  }
	get isWriteable() {
    return true
  }

  private get networkName(): string {
    return this.runtimeEnv.network.name;
  }

  private get checkpoint (): ScriptNetCheckpoint {
    return this.cpData.checkpoints[this.networkName];
  }

  putMetadata (key: string, value: string): void {
    this.checkpoint.metadata[key] = value;
  }

  getMetadata (key: string): string | undefined {
    return this.checkpoint.metadata[key];
  }

  containsAsset(name: string): boolean {
    return false;
  }

	deployASA (name: string, source: string, account: string): void {
  }

	deployASC (name: string, source: string, account: string): void {
  }

}

export class AlgobDeployerReadOnlyImpl implements AlgobDeployer {
  private readonly _internal: AlgobDeployer;

  constructor(deployer: AlgobDeployer) {
    this._internal = deployer
  }

	get accounts() {
    return this._internal.accounts
  }
	get isWriteable() {
    return false
  }
	putMetadata(key: string, value: string): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      "methodName": "putMetadata"
    });
	}
	getMetadata(key: string): string | undefined {
    return this._internal.getMetadata(key)
	}
	deployASA(name: string, source: string, account: string): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      "methodName": "deployASA"
    });
	}
	deployASC(name: string, source: string, account: string): void {
		throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      "methodName": "deployASC"
    });
	}
}
