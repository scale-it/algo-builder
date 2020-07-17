
import * as fs from "fs";
import YAML from "yaml";
import path from "path";
import { ScriptCheckpoint, ScriptNetCheckpoint, AlgobRuntimeEnv } from "../../types";

const artifactsPath = "artifacts";

export function toCheckpointFileName(scriptName: string): string {
  return path.join(artifactsPath, scriptName + ".cp.yaml")
}

export function appendToCheckpoint(
  prev: ScriptCheckpoint,
  networkName: string,
  append: ScriptNetCheckpoint
): ScriptCheckpoint {
  prev[networkName] = append
  return prev
}

export function appendEnv(
  prev: ScriptCheckpoint,
  runtimeEnv: AlgobRuntimeEnv
): ScriptCheckpoint {
  return appendToCheckpoint(prev, runtimeEnv.network.name, createNetCheckpoint())
}

export function createNetCheckpoint(): ScriptNetCheckpoint {
  return {
    timestamp: + new Date()
  }
}

export function persistCheckpoint(scriptName: string, checkpoint: ScriptCheckpoint) {
  const scriptPath = toCheckpointFileName(scriptName)
  const scriptDir = path.dirname(scriptPath)
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  fs.writeFileSync(
    scriptPath,
    YAML.stringify(checkpoint)
  )
}

export function loadCheckpoint(scriptName: string): ScriptCheckpoint {
  const scriptPath = toCheckpointFileName(scriptName)
  if (!fs.existsSync(scriptPath)) {
    return {}
  }
  return YAML.parse(fs.readFileSync(scriptPath).toString())
}
