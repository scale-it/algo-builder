import deepmerge from "deepmerge";
import * as fs from "fs";
import * as path from "path";

import type {
  AlgobConfig,
  ConfigExtender,
  ProjectPaths,
  ResolvedAlgobConfig,
  StrMap,
  UserPaths
} from "../../../types";
import { fromEntries } from "../../util/lang";
import { BuilderError } from "../errors";
import { ERRORS } from "../errors-list";

function mergeUserAndDefaultConfigs (
  defaultConfig: AlgobConfig,
  userConfig: AlgobConfig
): Partial<ResolvedAlgobConfig> {
  return deepmerge(defaultConfig, userConfig, {
    arrayMerge: (destination: any[], source: any[]) => source // eslint-disable-line @typescript-eslint/no-explicit-any
  }) as Partial<ResolvedAlgobConfig>;
}

/**
 * This functions resolves the algob config by merging the user provided config
 * and the algob default config.
 *
 * @param userConfigPath the user config filepath
 * @param defaultConfig  the algob's default config object
 * @param userConfig     the user config object
 * @param configExtenders An array of ConfigExtenders
 *
 * @returns the resolved config
 */
export function resolveConfig (
  userConfigPath: string | undefined,
  defaultConfig: AlgobConfig,
  userConfig: AlgobConfig,
  configExtenders: ConfigExtender[]
): ResolvedAlgobConfig {
  userConfig = deepFreezeUserConfig(userConfig);

  const config: Partial<ResolvedAlgobConfig> = mergeUserAndDefaultConfigs(defaultConfig, userConfig);

  const paths = userConfigPath !== undefined
    ? resolveProjectPaths(userConfigPath, userConfig.paths)
    : undefined;
  const resolved: ResolvedAlgobConfig = {
    ...config,
    paths,
    networks: config.networks ?? {}
  };

  for (const extender of configExtenders) {
    extender(resolved, userConfig);
  }

  return resolved;
}

function resolvePathFrom (
  from: string,
  defaultPath: string,
  relativeOrAbsolutePath: string = defaultPath
): string {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }

  return path.join(from, relativeOrAbsolutePath);
}

/**
 * This function resolves the ProjectPaths object from the user-provided config
 * and its path. The logic of this is not obvious and should well be document.
 * The good thing is that most users will never use this.
 *
 * Explanation:
 *    - paths.configFile is not overridable
 *    - If a path is absolute it is used "as is".
 *    - If the root path is relative, it's resolved from paths.configFile's dir.
 *    - If any other path is relative, it's resolved from paths.root.
 */
export function resolveProjectPaths (
  userConfigPath: string,
  userPaths: UserPaths = {}
): ProjectPaths {
  const configFile = fs.realpathSync(userConfigPath);
  const configDir = path.dirname(configFile);

  const root = resolvePathFrom(configDir, "", userPaths.root);

  const otherPathsEntries = Object.entries<string>(userPaths as StrMap).map<
  [string, string]
  >(([name, value]) => [name, resolvePathFrom(root, value)]);

  const otherPaths = fromEntries(otherPathsEntries);

  return {
    ...otherPaths,
    root,
    configFile,
    sources: resolvePathFrom(root, "contracts", userPaths.sources),
    cache: resolvePathFrom(root, "cache", userPaths.cache),
    artifacts: resolvePathFrom(root, "artifacts", userPaths.artifacts),
    tests: resolvePathFrom(root, "test", userPaths.tests)
  };
}

function deepFreezeUserConfig (
  config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  propertyPath: Array<string | number | symbol> = []
): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof config !== "object" || config === null) {
    return config;
  }

  return new Proxy(config, {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    get (target: any, property: string | number | symbol, receiver: any): any {
      return deepFreezeUserConfig(Reflect.get(target, property, receiver), [
        ...propertyPath,
        property
      ]);
    },

    set (
      target: any,
      property: string | number | symbol,
      value: any,
      receiver: any
    ): boolean {
      throw new BuilderError(ERRORS.GENERAL.USER_CONFIG_MODIFIED, {
        path: [...propertyPath, property]
          .map((pathPart) => pathPart.toString())
          .join(".")
      });
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
}
