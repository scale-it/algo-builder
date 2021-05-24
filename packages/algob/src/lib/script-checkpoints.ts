
import { loadFromYamlFileSilent, types as rtypes } from "@algo-builder/runtime";
import { encodeAddress, Transaction } from "algosdk";
import deepEqual from "deep-equal";
import * as fs from "fs";
import path from "path";
import YAML from "yaml";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  ASAInfo,
  AssetScriptMap,
  Checkpoint,
  CheckpointRepo,
  Checkpoints,
  Deployer,
  LsigInfo,
  SSCInfo,
  Timestamp
} from "../types";

export const scriptsDirectory = "scripts";
export const testsDirectory = "test";
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

export class CheckpointImpl implements Checkpoint {
  timestamp: number;
  metadata: Map<string, string>;
  asa: Map<string, ASAInfo>;
  ssc: Map<string, Map<Timestamp, SSCInfo>>;
  dLsig: Map<string, LsigInfo>;

  constructor (metadata?: Map<string, string>) {
    this.timestamp = +new Date();
    this.metadata = (metadata === undefined ? new Map<string, string>() : metadata);
    this.asa = new Map<string, ASAInfo>();
    const mp = new Map<Timestamp, SSCInfo>();
    this.ssc = new Map<string, typeof mp>();
    this.dLsig = new Map<string, LsigInfo>();
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
  orig.metadata = new Map([...orig.metadata, ...append.metadata]);
  const allAssetNames = [...append.asa.keys(), ...append.ssc.keys()];
  for (const assetName of allAssetNames) {
    if ((orig.asa.get(assetName) && !deepEqual(orig.asa.get(assetName), append.asa.get(assetName))) ??
      (orig.ssc.get(assetName) && !deepEqual(orig.ssc.get(assetName), append.ssc.get(assetName)))) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
        { assetName: assetName });
    }
  }
  orig.asa = new Map([...orig.asa, ...append.asa]);
  orig.ssc = new Map([...orig.ssc, ...append.ssc]);
  orig.dLsig = new Map([...orig.dLsig, ...append.dLsig]);
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
      const current = cp[k];
      const allAssetNames = [...current.asa.keys(), ...current.ssc.keys(), ...current.dLsig.keys()];
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
    this._ensureNet(this.allCPs, networkName).metadata.set(key, value);
    this._ensureNet(this.strippedCP, networkName).metadata.set(key, value);
    this._ensureNet(this.precedingCP, networkName).metadata.set(key, value);
    return this;
  }

  getMetadata (networkName: string, key: string): string | undefined {
    if (this.precedingCP[networkName]) {
      return this.precedingCP[networkName].metadata.get(key);
    }
    return undefined;
  }

  registerASA (networkName: string, name: string, info: ASAInfo): CheckpointRepo {
    this._ensureNet(this.precedingCP, networkName).asa.set(name, info);
    this._ensureNet(this.strippedCP, networkName).asa.set(name, info);
    this._ensureNet(this.allCPs, networkName).asa.set(name, info);
    return this;
  }

  private _ensureRegister (map: Map<string, Map<number, SSCInfo>>, name: string, info: SSCInfo): void {
    const nestedMap = map.get(name);
    if (nestedMap) {
      nestedMap.set(info.timestamp, info);
    } else {
      const newMap = new Map<number, SSCInfo>();
      newMap.set(info.timestamp, info);
      map.set(name, newMap);
    }
  }

  registerSSC (networkName: string, name: string, info: SSCInfo): CheckpointRepo {
    this._ensureRegister(this._ensureNet(this.precedingCP, networkName).ssc, name, info);
    this._ensureRegister(this._ensureNet(this.strippedCP, networkName).ssc, name, info);
    this._ensureRegister(this._ensureNet(this.allCPs, networkName).ssc, name, info);
    return this;
  }

  registerLsig (networkName: string, name: string, info: LsigInfo): CheckpointRepo {
    this._ensureNet(this.precedingCP, networkName).dLsig.set(name, info);
    this._ensureNet(this.strippedCP, networkName).dLsig.set(name, info);
    this._ensureNet(this.allCPs, networkName).dLsig.set(name, info);
    return this;
  }

  isDefined (networkName: string, name: string): boolean {
    const netCP = this.allCPs[networkName];
    return netCP !== undefined &&
      (netCP.asa.get(name) !== undefined || netCP.ssc.get(name) !== undefined ||
      netCP.dLsig.get(name) !== undefined);
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

/**
 * Register checkpoints for ASA and SSC
 * @param deployer Deployer object
 * @param txns transaction array
 * @param txIdxMap transaction map index to name
 */
export async function registerCheckpoints (
  deployer: Deployer,
  txns: Transaction[],
  txIdxMap: Map<number, [string, rtypes.ASADef]>
): Promise<void> {
  for (const [idx, txn] of txns.entries()) {
    let txConfirmation;
    const res = txIdxMap.get(idx);
    switch (txn.type) {
      case 'acfg': {
        txConfirmation = await deployer.waitForConfirmation(txn.txID());
        if (res) {
          const asaInfo: ASAInfo = {
            creator: encodeAddress(txn.from.publicKey),
            txId: txn.txID(),
            assetIndex: txConfirmation["asset-index"],
            confirmedRound: txConfirmation['confirmed-round'],
            assetDef: res[1]
          };
          deployer.registerASAInfo(res[0], asaInfo);
          deployer.logTx("Deploying ASA: " + res[0], txConfirmation);
        }
        break;
      }
      case 'appl': {
        txConfirmation = await deployer.waitForConfirmation(txn.txID());
        const sscInfo: SSCInfo = {
          creator: encodeAddress(txn.from.publicKey),
          txId: txn.txID(),
          appID: txConfirmation['application-index'],
          confirmedRound: txConfirmation['confirmed-round'],
          timestamp: Math.round(+new Date() / 1000)
        };
        if (res) {
          const val = deployer.getSSCfromCPKey(res[0]);
          if (val?.appID === sscInfo.appID) {
            deployer.logTx("Updating SSC: " + res[0], txConfirmation);
          } else {
            deployer.logTx("Deploying SSC: " + res[0], txConfirmation);
          }
          deployer.registerSSCInfo(res[0], sscInfo);
        }
        break;
      }
    }
  }
}

// http://xahlee.info/js/js_object_to_map_datatype.html
export function toMap <T> (obj: {[name: string]: T}): Map<string, T> {
  const mp = new Map();
  Object.keys(obj).forEach(k => { mp.set(k, obj[k]); });
  return mp;
};

function convertCPValsToMaps (cpWithObjects: Checkpoint): Checkpoint {
  cpWithObjects.asa = toMap(cpWithObjects.asa as any);
  cpWithObjects.ssc = toMap(cpWithObjects.ssc as any);
  cpWithObjects.dLsig = toMap(cpWithObjects.dLsig as any);
  cpWithObjects.metadata = toMap(cpWithObjects.metadata as any);
  return cpWithObjects;
}

export function loadCheckpointByCPName (checkpointName: string): Checkpoints {
  // Some structures are objects, some others are maps. Oh why.
  const checkpoints = loadFromYamlFileSilent(checkpointName, { mapAsMap: false });
  for (const k of Object.keys(checkpoints)) {
    convertCPValsToMaps(checkpoints[k]);
  }
  return checkpoints;
}

export function loadCheckpoint (scriptName: string): Checkpoints {
  return loadCheckpointByCPName(toCheckpointFileName(scriptName));
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
      return out.mergeToGlobal(loadCheckpointByCPName(filename), toScriptFileName(filename));
    },
    new CheckpointRepoImpl());
}

export function loadCheckpointsIntoCPData (cpData: CheckpointRepo, scriptPaths: string[]): CheckpointRepo {
  var checkpointData = cpData;
  for (const s of scriptPaths) {
    checkpointData = cpData.merge(loadCheckpoint(s), s);
  }
  return checkpointData;
}
