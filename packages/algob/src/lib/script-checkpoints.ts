
import deepEqual from "deep-equal";
import * as fs from "fs";
import path from "path";
import YAML from "yaml";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  ASAInfo,
  ASCInfo,
  AssetScriptMap,
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

export function toScriptFileName (filename: string): string {
  filename = filename.replace(artifactsPath + path.sep, '');
  filename = filename.slice(0, -(checkpointFileSuffix.length));
  return filename;
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
  scriptMap: AssetScriptMap = {};

  private _mergeTo (target: Checkpoints, cp: Checkpoints, scriptMap: AssetScriptMap): Checkpoints {
    const keys: string[] = Object.keys(cp);
    return keys.reduce((out: Checkpoints, key: string) => {
      return appendToCheckpoint(out, key, cp[key]);
    }, target);
  }

  merge (cp: Checkpoints, scriptName: string): CheckpointRepo {
    this.strippedCP = cp;
    this.precedingCP = this._mergeTo(this.precedingCP, cp, this.scriptMap);
    this.mergeToGlobal(cp, scriptName);
    return this;
  }

  mergeToGlobal (cp: Checkpoints, scriptName: string): CheckpointRepo {
    const keys: string[] = Object.keys(cp);
    for (const k of keys) {
      const orig = cp[k];
      const allAssetNames = Object.keys(orig.asa).concat(Object.keys(orig.asc));
      for (const assetName of allAssetNames) {
        if (!(this.scriptMap[assetName])) {
          this.scriptMap[assetName] = scriptName;
        } else {
          if (this.scriptMap[assetName] !== scriptName) {
            throw new BuilderError(
              ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
              { assetName: [this.scriptMap[assetName], scriptName] });
          }
        }
      }
    }
    this.allCPs = this._mergeTo(this.allCPs, cp, this.scriptMap);
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
      return out.mergeToGlobal(loadCheckpointNoSuffix(filename), toScriptFileName(filename));
    },
    new CheckpointRepoImpl());
}
