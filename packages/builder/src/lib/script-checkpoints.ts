
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
  AccountDef,
  ScriptCheckpoints,
  ScriptNetCheckpoint
} from "../types";

export const scriptsDirectory = "scripts";
const artifactsPath = "artifacts";

export function toCheckpointFileName (scriptName: string): string {
  return path.join(artifactsPath, scriptName + ".cp.yaml");
}

export function registerASA (
  cp: ScriptNetCheckpoint, name: string, creator: string): ScriptNetCheckpoint {
  cp.asa[name] = { creator: creator }
  return cp
}

export function registerASC (
  cp: ScriptNetCheckpoint, name: string, creator: string): ScriptNetCheckpoint {
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

export function appendToCheckpoint (
  checkpoints: ScriptCheckpoints, networkName: string, append: ScriptNetCheckpoint): ScriptCheckpoints {
  const orig = checkpoints[networkName]
  if (!orig) {
    checkpoints[networkName] = Object.assign({}, append);
    return checkpoints;
  }
  orig.timestamp = append.timestamp;
  orig.metadata = Object.assign(
    {}, orig.metadata, append.metadata
  );
  const allAssetNames = Object.keys(append.asa).concat(Object.keys(append.asc))
  for (const assetName of allAssetNames) {
    if (orig.asa[assetName] || orig.asc[assetName]) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
        { assetName: assetName });
    }
  }
  orig.asa = Object.assign(
    {}, orig.asa, append.asa
  );
  orig.asc = Object.assign(
    {}, orig.asc, append.asc
  );
  return checkpoints;
}

export class CheckpointDataImpl implements CheckpointData {
	strippedCP: ScriptCheckpoints = {};
  visibleCP: ScriptCheckpoints = {};
	globalCP: ScriptCheckpoints = {};

  private _mergeTo(target: ScriptCheckpoints, cp: ScriptCheckpoints) {
    const keys: string[] = Object.keys(cp);
    return keys.reduce((out: ScriptCheckpoints, key: string) => {
      return appendToCheckpoint(out, key, cp[key]);
    }, target);
  }

  merge (cp: ScriptCheckpoints): CheckpointData {
    this.strippedCP = cp
    this.visibleCP = this._mergeTo(this.visibleCP, cp)
    this.mergeToGlobal(cp)
    return this
  }

  mergeToGlobal (cp: ScriptCheckpoints): CheckpointData {
    this.globalCP = this._mergeTo(this.globalCP, cp)
    return this
  }

  private _ensureNet(cp: ScriptCheckpoints, networkName: string): ScriptNetCheckpoint {
    if (!cp[networkName]) {
      cp[networkName] = new ScriptNetCheckpointImpl()
    }
    return cp[networkName]
  }

	putMetadata(networkName: string, key: string, value: string): CheckpointData {
    this._ensureNet(this.globalCP, networkName).metadata[key] = value
    this._ensureNet(this.strippedCP, networkName).metadata[key] = value
    this._ensureNet(this.visibleCP, networkName).metadata[key] = value
    return this
	}
	getMetadata(networkName: string, key: string): string | undefined {
    if (this.visibleCP[networkName]) {
      return this.visibleCP[networkName].metadata[key];
    }
    return
	}

	registerASA(networkName: string, name: string, creator: string): CheckpointData {
    registerASA(this._ensureNet(this.visibleCP, networkName), name, creator)
    registerASA(this._ensureNet(this.strippedCP, networkName), name, creator)
    registerASA(this._ensureNet(this.globalCP, networkName), name, creator)
    return this
	}
	registerASC(networkName: string, name: string, creator: string): CheckpointData {
    registerASC(this._ensureNet(this.visibleCP, networkName), name, creator)
    registerASC(this._ensureNet(this.strippedCP, networkName), name, creator)
    registerASC(this._ensureNet(this.globalCP, networkName), name, creator)
    return this
	}

	isAssetDefined(networkName: string, name: string): boolean {
    const netCP = this.globalCP[networkName]
    return netCP !== undefined
      && (netCP.asa[name] !== undefined || netCP.asc[name] !== undefined)
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
    this.cpData = cpData;
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

  putMetadata (key: string, value: string): void {
    this.cpData.putMetadata(this.networkName, key, value)
  }

  getMetadata (key: string): string | undefined {
    return this.cpData.getMetadata(this.networkName, key)
  }

  async deployASA (name: string, source: string, account: string): Promise<ASAInfo> {
    this.cpData.registerASA(this.networkName, name, account + "-get-address")
    return this.cpData.visibleCP[this.networkName].asa[name]
  }

  async deployASC (name: string, source: string, account: string): Promise<ASCInfo> {
    this.cpData.registerASC(this.networkName, name, account + "-get-address")
    return this.cpData.visibleCP[this.networkName].asc[name]
  }

	isAssetDefined(name: string): boolean {
    return this.cpData.isAssetDefined(this.networkName, name)
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

	isAssetDefined(name: string): boolean {
    return this._internal.isAssetDefined(name)
	}
}
