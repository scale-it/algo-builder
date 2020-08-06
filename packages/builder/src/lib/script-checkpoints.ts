
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
  Checkpoint,
  CheckpointRepo,
  Checkpoints
} from "../types";

export const scriptsDirectory = "scripts";
const artifactsPath = "artifacts";
const checkpointFileSuffix = ".cp.yaml";

export function toCheckpointFileName (scriptName: string): string {
  return path.join(artifactsPath, scriptName + checkpointFileSuffix);
}

export function registerASA (
  cp: Checkpoint, name: string, creator: string): Checkpoint {
  cp.asa[name] = { creator: creator };
  return cp;
}

export function registerASC (
  cp: Checkpoint, name: string, creator: string): Checkpoint {
  cp.asc[name] = { creator: creator };
  return cp;
}

export class CheckpointImpl implements Checkpoint {
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
  checkpoints: Checkpoints, networkName: string, append: Checkpoint): Checkpoints {
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

export class CheckpointRepoImpl implements CheckpointRepo {
  strippedCP: Checkpoints = {};
  precedingCP: Checkpoints = {};
  allCPs: Checkpoints = {};

  private _mergeTo (target: Checkpoints, cp: Checkpoints): Checkpoints {
    const keys: string[] = Object.keys(cp);
    return keys.reduce((out: Checkpoints, key: string) => {
      return appendToCheckpoint(out, key, cp[key]);
    }, target);
  }

  merge (cp: Checkpoints): CheckpointRepo {
    this.strippedCP = cp;
    this.precedingCP = this._mergeTo(this.precedingCP, cp);
    this.mergeToGlobal(cp);
    return this;
  }

  mergeToGlobal (cp: Checkpoints): CheckpointRepo {
    this.allCPs = this._mergeTo(this.allCPs, cp);
    return this;
  }

  private _ensureNet (cp: Checkpoints, networkName: string): Checkpoint {
    if (!cp[networkName]) {
      cp[networkName] = new CheckpointImpl();
    }
    return cp[networkName];
  }

  putMetadata (networkName: string, key: string, value: string): CheckpointRepo {
    this._ensureNet(this.allCPs, networkName).metadata[key] = value;
    this._ensureNet(this.strippedCP, networkName).metadata[key] = value;
    this._ensureNet(this.precedingCP, networkName).metadata[key] = value;
    return this;
  }

  getMetadata (networkName: string, key: string): string | undefined {
    if (this.precedingCP[networkName]) {
      return this.precedingCP[networkName].metadata[key];
    }
    return undefined;
  }

  registerASA (networkName: string, name: string, creator: string): CheckpointRepo {
    registerASA(this._ensureNet(this.precedingCP, networkName), name, creator);
    registerASA(this._ensureNet(this.strippedCP, networkName), name, creator);
    registerASA(this._ensureNet(this.allCPs, networkName), name, creator);
    return this;
  }

  registerASC (networkName: string, name: string, creator: string): CheckpointRepo {
    registerASC(this._ensureNet(this.precedingCP, networkName), name, creator);
    registerASC(this._ensureNet(this.strippedCP, networkName), name, creator);
    registerASC(this._ensureNet(this.allCPs, networkName), name, creator);
    return this;
  }

  isDefined (networkName: string, name: string): boolean {
    const netCP = this.allCPs[networkName];
    return netCP !== undefined &&
      (netCP.asa[name] !== undefined || netCP.asc[name] !== undefined);
  }

  networkExistsInCurrentCP (networkName: string): boolean {
    return Boolean(this.strippedCP[networkName]);
  }
}

export function persistCheckpoint (scriptName: string, checkpoint: Checkpoints): void {
  const scriptPath = toCheckpointFileName(scriptName);
  const scriptDir = path.dirname(scriptPath);
  fs.mkdirSync(scriptDir, { recursive: true });
  fs.writeFileSync(
    scriptPath,
    YAML.stringify(checkpoint)
  );
}

export function loadCheckpointNoSuffix (checkpointPath: string): Checkpoints {
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

export function loadCheckpoint (scriptName: string): Checkpoints {
  return loadCheckpointNoSuffix(toCheckpointFileName(scriptName));
}

function lsTreeWalk (directoryName: string): string[] {
  var list: string[] = [];
  fs.readdirSync(directoryName).forEach(file => {
    var fullPath = path.join(directoryName, file);
    const f = fs.statSync(fullPath);
    if (f.isDirectory()) {
      list = list.concat(lsTreeWalk(fullPath));
    } else {
      list.push(fullPath);
    }
  });
  return list;
};

function lsFiles (directoryName: string): string[] {
  var list: string[] = [];
  fs.readdirSync(directoryName).forEach(file => {
    var fullPath = path.join(directoryName, file);
    const f = fs.statSync(fullPath);
    if (f.isFile()) {
      list.push(fullPath);
    }
  });
  return list;
};

function ensureCheckpointsPath (): string {
  const checkpointsPath = path.join(".", artifactsPath, scriptsDirectory);
  fs.mkdirSync(checkpointsPath, { recursive: true });
  return checkpointsPath;
}

function findCheckpointsRecursive (): string[] {
  return lsTreeWalk(ensureCheckpointsPath())
    .filter(filename => filename.endsWith(checkpointFileSuffix));
}

export function lsScriptsDir (): string[] {
  return lsFiles(scriptsDirectory);
}

export function loadCheckpointsRecursive (): CheckpointRepo {
  return findCheckpointsRecursive().reduce(
    (out: CheckpointRepo, filename: string) => {
      return out.mergeToGlobal(loadCheckpointNoSuffix(filename));
    },
    new CheckpointRepoImpl());
}

// This class is what user interacts with in deploy task
export class AlgobDeployerImpl implements AlgobDeployer {
  private readonly runtimeEnv: AlgobRuntimeEnv;
  private readonly cpData: CheckpointRepo;

  constructor (runtimeEnv: AlgobRuntimeEnv, cpData: CheckpointRepo) {
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
    return this.cpData.precedingCP[this.networkName].asa[name];
  }

  async deployASC (name: string, source: string, account: string): Promise<ASCInfo> {
    this.assertNoAsset(name);
    this.cpData.registerASC(this.networkName, name, account + "-get-address");
    return this.cpData.precedingCP[this.networkName].asc[name];
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
