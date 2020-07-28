
import * as fs from "fs";
import path from "path";
import YAML from "yaml";

import { AlgobDeployer, AlgobRuntimeEnv, ScriptCheckpoint, ScriptNetCheckpoint } from "../types";

export const scriptsDirectory = "scripts";
const artifactsPath = "artifacts";

export function toCheckpointFileName (scriptName: string): string {
  return path.join(artifactsPath, scriptName + ".cp.yaml");
}

export function appendToCheckpoint (
  prev: ScriptCheckpoint,
  networkName: string,
  append: ScriptNetCheckpoint
): ScriptCheckpoint {
  if (prev[networkName]) {
    prev[networkName].timestamp = append.timestamp;
    prev[networkName].metadata = Object.assign({}, prev[networkName].metadata, append.metadata);
    return prev;
  }
  prev[networkName] = append;
  return prev;
}

export function mergeCheckpoints (
  prev: ScriptCheckpoint,
  curr: ScriptCheckpoint
): ScriptCheckpoint {
  const keys: string[] = Object.keys(curr);
  return keys.reduce((out: ScriptCheckpoint, key: string) => {
    return appendToCheckpoint(out, key, curr[key]);
  }, prev);
}

export function appendEnv (
  prev: ScriptCheckpoint,
  runtimeEnv: AlgobRuntimeEnv
): ScriptCheckpoint {
  return appendToCheckpoint(prev, runtimeEnv.network.name, createNetCheckpoint());
}

export function createNetCheckpoint (metadata?: {[key: string]: string}): ScriptNetCheckpoint {
  return {
    timestamp: +new Date(),
    metadata: metadata === undefined ? {} : metadata
  };
}

export function persistCheckpoint (scriptName: string, checkpoint: ScriptCheckpoint): void {
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

export function loadCheckpoint (scriptName: string): ScriptCheckpoint {
  const scriptPath = toCheckpointFileName(scriptName);
  if (!fs.existsSync(scriptPath)) {
    return {};
  }
  return YAML.parse(fs.readFileSync(scriptPath).toString());
}

export class AlgobDeployerImpl implements AlgobDeployer {
  private readonly runtimeEnv: AlgobRuntimeEnv;
  checkpoints: ScriptCheckpoint;

  constructor (runtimeEnv: AlgobRuntimeEnv) {
    this.runtimeEnv = runtimeEnv;
    this.checkpoints = {};
    this.checkpoints = appendEnv({}, runtimeEnv);
  }

  get networkName (): string {
    return this.runtimeEnv.network.name;
  }

  get checkpoint (): ScriptNetCheckpoint {
    return this.checkpoints[this.networkName];
  }

  putMetadata (key: string, value: string): void {
    this.checkpoint.metadata[key] = value;
  }

  getMetadata (key: string): string | undefined {
    return this.checkpoint.metadata[key];
  }

  appendCheckpoints (loaded: ScriptCheckpoint): AlgobDeployerImpl {
    this.checkpoints = mergeCheckpoints(
      this.checkpoints,
      loaded);
    return this;
  }
}
