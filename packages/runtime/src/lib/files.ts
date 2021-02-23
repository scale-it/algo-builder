import fs from "fs";
import YAML from "yaml";

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
