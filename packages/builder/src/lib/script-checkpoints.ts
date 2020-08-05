
import deepEqual from "deep-equal";
import * as fs from "fs";
import path from "path";
import YAML from "yaml";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  AccountDef,
  AlgobDeployer,
  AlgobRuntimeEnv,
  ASAInfo,
  ASCInfo,
  CheckpointData,
  ScriptCheckpoints,
  ScriptNetCheckpoint
} from "../types";

export const scriptsDirectory = "scripts";
const artifactsPath = "artifacts";
const checkpointFileSuffix = ".cp.yaml";

export function toCheckpointFileName (scriptName: string): string {
  return path.join(artifactsPath, scriptName + checkpointFileSuffix);
}

export function registerASA (
  cp: ScriptNetCheckpoint, name: string, creator: string): ScriptNetCheckpoint {
  cp.asa[name] = { creator: creator };
  return cp;
}

export function registerASC (
  cp: ScriptNetCheckpoint, name: string, creator: string): ScriptNetCheckpoint {
  cp.asc[name] = { creator: creator };
  return cp;
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
  const orig = checkpoints[networkName];
  if (!orig) {
    checkpoints[networkName] = Object.assign({}, append);
    return checkpoints;
  }
  orig.timestamp = append.timestamp;
  orig.metadata = Object.assign(
    {}, orig.metadata, append.metadata
  );
  const allAssetNames = Object.keys(append.asa).concat(Object.keys(append.asc));
  for (const assetName of allAssetNames) {
    if ((orig.asa[assetName] && !deepEqual(orig.asa[assetName], append.asa[assetName])) ||
      (orig.asc[assetName] && !deepEqual(orig.asc[assetName], append.asc[assetName]))) {
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

  private _mergeTo (target: ScriptCheckpoints, cp: ScriptCheckpoints): ScriptCheckpoints {
    const keys: string[] = Object.keys(cp);
    return keys.reduce((out: ScriptCheckpoints, key: string) => {
      return appendToCheckpoint(out, key, cp[key]);
    }, target);
  }

  merge (cp: ScriptCheckpoints): CheckpointData {
    this.strippedCP = cp;
    this.visibleCP = this._mergeTo(this.visibleCP, cp);
    this.mergeToGlobal(cp);
    return this;
  }

  mergeToGlobal (cp: ScriptCheckpoints): CheckpointData {
    this.globalCP = this._mergeTo(this.globalCP, cp);
    return this;
  }

  private _ensureNet (cp: ScriptCheckpoints, networkName: string): ScriptNetCheckpoint {
    if (!cp[networkName]) {
      cp[networkName] = new ScriptNetCheckpointImpl();
    }
    return cp[networkName];
  }

  putMetadata (networkName: string, key: string, value: string): CheckpointData {
    this._ensureNet(this.globalCP, networkName).metadata[key] = value;
    this._ensureNet(this.strippedCP, networkName).metadata[key] = value;
    this._ensureNet(this.visibleCP, networkName).metadata[key] = value;
    return this;
  }

  getMetadata (networkName: string, key: string): string | undefined {
    if (this.visibleCP[networkName]) {
      return this.visibleCP[networkName].metadata[key];
    }
    return undefined;
  }

  registerASA (networkName: string, name: string, creator: string): CheckpointData {
    registerASA(this._ensureNet(this.visibleCP, networkName), name, creator);
    registerASA(this._ensureNet(this.strippedCP, networkName), name, creator);
    registerASA(this._ensureNet(this.globalCP, networkName), name, creator);
    return this;
  }

  registerASC (networkName: string, name: string, creator: string): CheckpointData {
    registerASC(this._ensureNet(this.visibleCP, networkName), name, creator);
    registerASC(this._ensureNet(this.strippedCP, networkName), name, creator);
    registerASC(this._ensureNet(this.globalCP, networkName), name, creator);
    return this;
  }

  isDefined (networkName: string, name: string): boolean {
    const netCP = this.globalCP[networkName];
    return netCP !== undefined &&
      (netCP.asa[name] !== undefined || netCP.asc[name] !== undefined);
  }
}

export function persistCheckpoint (scriptName: string, checkpoint: ScriptCheckpoints): void {
  const scriptPath = toCheckpointFileName(scriptName);
  const scriptDir = path.dirname(scriptPath);
  fs.mkdirSync(scriptDir, { recursive: true });
  fs.writeFileSync(
    scriptPath,
    YAML.stringify(checkpoint)
  );
}

export function loadCheckpointNoSuffix (checkpointPath: string): ScriptCheckpoints {
  // Try-catch is the way:
  // https://nodejs.org/docs/latest/api/fs.html#fs_fs_stat_path_options_callback
  // Instead, user code should open/read/write the file directly and
  // handle the error raised if the file is not available
  try {
    return YAML.parse(fs.readFileSync(checkpointPath).toString());
  } catch (e) {
    return {};
  }
}

export function loadCheckpoint (scriptName: string): ScriptCheckpoints {
  return loadCheckpointNoSuffix(toCheckpointFileName(scriptName));
}

function walk (directoryName: string): string[] {
  var list: string[] = [];
  fs.readdirSync(directoryName).forEach(file => {
    var fullPath = path.join(directoryName, file);
    const f = fs.statSync(fullPath);
    if (f.isDirectory()) {
      list = list.concat(walk(fullPath));
    } else {
      list.push(fullPath);
    }
  });
  return list;
};

function findCheckpointsRecursive (): string[] {
  const checkpointsPath = path.join(".", artifactsPath, scriptsDirectory);
  fs.mkdirSync(checkpointsPath, { recursive: true });
  return walk(checkpointsPath)
    .filter(filename => filename.endsWith(checkpointFileSuffix));
}

export function loadCheckpointsRecursive (): CheckpointData {
  return findCheckpointsRecursive().reduce(
    (out: CheckpointData, filename: string) => {
      return out.mergeToGlobal(loadCheckpointNoSuffix(filename));
    },
    new CheckpointDataImpl());
}

// This class is what user interacts with in deploy task
export class AlgobDeployerImpl implements AlgobDeployer {
  private readonly runtimeEnv: AlgobRuntimeEnv;
  private readonly cpData: CheckpointData;

  constructor (runtimeEnv: AlgobRuntimeEnv, cpData: CheckpointData) {
    this.runtimeEnv = runtimeEnv;
    this.cpData = cpData;
  }

  get accounts (): AccountDef[] {
    return this.runtimeEnv.network.config.accounts;
  }

  get isWriteable (): boolean {
    return true;
  }

  private get networkName (): string {
    return this.runtimeEnv.network.name;
  }

  putMetadata (key: string, value: string): void {
    if (this.cpData.getMetadata(this.networkName, key) === value) {
      return;
    }
    if (this.cpData.getMetadata(this.networkName, key)) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_METADATA_ALREADY_PRESENT, {
          metadataKey: key
        });
    }
    this.cpData.putMetadata(this.networkName, key, value);
  }

  getMetadata (key: string): string | undefined {
    return this.cpData.getMetadata(this.networkName, key);
  }

  private assertNoAsset (name: string): void {
    if (this.isDefined(name)) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT, {
          assetName: name
        });
    }
  }

  async deployASA (name: string, source: string, account: string): Promise<ASAInfo> {
    this.assertNoAsset(name);
    this.cpData.registerASA(this.networkName, name, account + "-get-address");
    return this.cpData.visibleCP[this.networkName].asa[name];
  }

  async deployASC (name: string, source: string, account: string): Promise<ASCInfo> {
    this.assertNoAsset(name);
    this.cpData.registerASC(this.networkName, name, account + "-get-address");
    return this.cpData.visibleCP[this.networkName].asc[name];
  }

  isDefined (name: string): boolean {
    return this.cpData.isDefined(this.networkName, name);
  }
}

// This class is what user interacts with in run task
export class AlgobDeployerReadOnlyImpl implements AlgobDeployer {
  private readonly _internal: AlgobDeployer;

  constructor (deployer: AlgobDeployer) {
    this._internal = deployer;
  }

  get accounts (): AccountDef[] {
    return this._internal.accounts;
  }

  get isWriteable (): boolean {
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

  isDefined (name: string): boolean {
    return this._internal.isDefined(name);
  }
}
