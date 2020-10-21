import fs from "fs";
import path from "path";
import YAML from "yaml";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";

function normalizePaths (mainPath: string, paths: string[]): string[] {
  return paths.map(n => path.relative(mainPath, n));
}

export function assertDirChildren (dir: string, scriptNames: string[]): string[] {
  const normalized = normalizePaths(".", scriptNames);
  const nonScriptPaths = normalized
    .filter(scriptName => !path.relative(".", scriptName).startsWith(dir));
  if (nonScriptPaths.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY, {
      scripts: nonScriptPaths
    });
  }
  return normalized;
}

export function assertDirectDirChildren (dir: string, scriptNames: string[]): string[] {
  const normalized = normalizePaths(".", scriptNames);
  const badPaths = normalized.filter(scriptName => path.dirname(scriptName) !== dir);
  if (badPaths.length !== 0) {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOY_SCRIPT_NON_DIRECT_CHILD, {
      scripts: badPaths
    });
  }
  return normalized;
}

function readYAML (filePath: string, options?: YAML.Options): any {
  return YAML.parse(fs.readFileSync(filePath).toString(), options);
}

function defaultYamlValue (options?: YAML.Options): any {
  if (options?.mapAsMap) {
    return new Map<string, any>();
  }
  return {};
}

export function loadFromYamlFileSilent (filePath: string, options?: YAML.Options): any {
  // Try-catch is the way:
  // https://nodejs.org/docs/latest/api/fs.html#fs_fs_stat_path_options_callback
  // Instead, user code should open/read/write the file directly and
  // handle the error raised if the file is not available
  try {
    return readYAML(filePath, options);
  } catch (e) {
    return defaultYamlValue(options);
  }
}

export function loadFromYamlFileSilentWithMessage (
  filePath: string, messageIfNotPresent: string, options?: YAML.Options): any {
  try {
    return readYAML(filePath, options);
  } catch (e) {
    console.warn(messageIfNotPresent);
    return defaultYamlValue(options);
  }
}
