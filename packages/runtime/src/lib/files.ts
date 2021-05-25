import * as fsWalk from '@nodelib/fs.walk';
import fs from "fs";
import path from "path";
import YAML from "yaml";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";

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

/**
 * Reads the directory recursively and returns all paths
 * @param directoryName name of directory
 */
export function lsTreeWalk (directoryName: string): string[] {
  return fsWalk.walkSync(directoryName).map(f => f.path);
};

/**
 * Searches recursively and returns path of file in a given directory. Throws error
 * if multiple files with same name are found (in directory or sub-directory)
 * @param dir directory name
 * @param fileName name of file to search in directory
 * @param warnMsg if file does not exist & warning message is passed,
 * then console log warning, and return. throws error otherwise
 */
export function getPathFromDirRecursive (
  dir: string,
  fileName: string,
  warnMsg?: string): string | undefined {
  const paths = lsTreeWalk(dir);

  let filePath;
  for (const p of paths) {
    const fileNameFromPath = path.basename(p);
    if (fileNameFromPath === fileName) {
      if (filePath) { // if file already found previously, throw error
        throw new RuntimeError(RUNTIME_ERRORS.GENERAL.MULTIPLE_FILES_WITH_SAME_NAME_IN_DIR, {
          directory: dir,
          file: fileName,
          path1: filePath,
          path2: p
        });
      } else {
        filePath = p;
      }
    }
  }

  if (!filePath) {
    if (warnMsg) { console.warn(warnMsg); return; }
    throw new RuntimeError(RUNTIME_ERRORS.GENERAL.FILE_NOT_FOUND_IN_DIR, {
      file: fileName,
      directory: dir
    });
  }
  return filePath;
}
