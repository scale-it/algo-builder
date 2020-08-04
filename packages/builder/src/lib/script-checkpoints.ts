
import * as fs from "fs";
import path from "path";
import { DeepReadonly } from "ts-essentials";
import YAML from "yaml";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  AlgobDeployer,
  AlgobRuntimeEnv,
  ASAInfo,
  ASCInfo,
  CheckpointData,
  DeployedASAInfo,
  DeployedASCInfo,
  NetworkAccounts,
  ScriptCheckpoints,
  ScriptNetCheckpoint
} from "../types";

export const scriptsDirectory = "scripts";
const artifactsPath = "artifacts";

export function toCheckpointFileName (scriptName: string): string {
  return path.join(artifactsPath, scriptName + ".cp.yaml");
}

export function registerASA (cp: ScriptNetCheckpoint, name: string, creator: string): ScriptNetCheckpoint {
  cp.asa[name] = { creator: creator }
  return cp
}

export function registerASC (cp: ScriptNetCheckpoint, name: string, creator: string): ScriptNetCheckpoint {
  cp.asc[name] = { creator: creator }
  return cp
}

export class ScriptNetCheckpointImpl implements ScriptNetCheckpoint {
  timestamp: number;
  metadata: { [key: string]: string };
  asa: { [name: string]: ASAInfo };
  asc: { [name: string]: ASCInfo };

  constructor (metadata?: {[key: string]: string}) {
    this.timestamp = +new Date();
    this.metadata = (metadata === undefined ? {} : metadata);
    this.asa = {};
    this.asc = {};
  }
}

export class CheckpointDataImpl implements CheckpointData {
  checkpoints: ScriptCheckpoints = {};
  deployedASA: { [assetName: string]: DeployedASAInfo } = {};
  deployedASC: { [assetName: string]: DeployedASCInfo } = {};

  appendToCheckpoint (networkName: string, append: ScriptNetCheckpoint): CheckpointData {
    const cp = this.checkpoints[networkName]
    if (!cp) {
      this.checkpoints[networkName] = append;
      return this;
    }
    cp.timestamp = append.timestamp;
    cp.metadata = Object.assign(
      {}, cp.metadata, append.metadata
    );
    const allAssetNames = Object.keys(append.asa).concat(Object.keys(append.asc))
    for (const assetName of allAssetNames) {
      if (cp.asa[assetName] || cp.asc[assetName]) {
        throw new BuilderError(
          ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
          { assetName: assetName });
      }
    }
    cp.asa = Object.assign(
      {}, cp.asa, append.asa
    );
    cp.asc = Object.assign(
      {}, cp.asc, append.asc
    );
    return this;
  }

  mergeCheckpoints (curr: ScriptCheckpoints): CheckpointData {
    const keys: string[] = Object.keys(curr);
    return keys.reduce((out: CheckpointData, key: string) => {
      return this.appendToCheckpoint(key, curr[key]);
    }, this);
  }

  appendEnv (runtimeEnv: AlgobRuntimeEnv): CheckpointData {
    return this.appendToCheckpoint(runtimeEnv.network.name, new ScriptNetCheckpointImpl());
  }
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

  get isWriteable () {
    return true;
  }

  private get networkName (): string {
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

  containsAsset (name: string): boolean {
    return false;
  }

  async deployASA (name: string, source: string, account: string): Promise<ASAInfo> {
    registerASA(this.checkpoint, name, account + "-get-address")
    return this.checkpoint.asa[name]
  }

  async deployASC (name: string, source: string, account: string): Promise<ASCInfo> {
    registerASC(this.checkpoint, name, account + "-get-address")
    return this.checkpoint.asc[name]
  }
}

export class AlgobDeployerReadOnlyImpl implements AlgobDeployer {
  private readonly _internal: AlgobDeployer;

  constructor (deployer: AlgobDeployer) {
    this._internal = deployer;
  }

  get accounts () {
    return this._internal.accounts;
  }

  get isWriteable () {
    return false;
  }

  putMetadata (key: string, value: string): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "putMetadata"
    });
  }

  getMetadata (key: string): string | undefined {
    return this._internal.getMetadata(key);
  }

  async deployASA (name: string, source: string, account: string): Promise<ASAInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASA"
    });
  }

  async deployASC (name: string, source: string, account: string): Promise<ASCInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASC"
    });
  }

  containsAsset (name: string): boolean {
    return this._internal.containsAsset(name);
  }
}
