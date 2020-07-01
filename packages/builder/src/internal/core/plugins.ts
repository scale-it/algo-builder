import debug from "debug";
import * as path from "path";
import * as semver from "semver";

import { BuilderContext } from "../context";
import { BuilderError } from "./errors";
import { ERRORS } from "./errors-list";
import { ExecutionMode, getExecutionMode } from "./execution-mode";

const log = debug("builder:core:plugins");

interface PackageJson {
  name: string;
  version: string;
  peerDependencies: {
    [name: string]: string;
  };
}

/**
 * Validates a plugin dependencies and loads it.
 * @param pluginName - The plugin name
 * @param builderContext - The BuilderContext
 * @param from - Where to resolve plugins and dependencies from. Only for
 * testing purposes.
 */
export function usePlugin(
  builderContext: BuilderContext,
  pluginName: string,
  from?: string
) {
  log("Loading plugin %s", pluginName);

  // We have a special case for `ExecutionMode.EXECUTION_MODE_LINKED`
  //
  // If Builder is linked, a require without `from` would be executed in the
  // context of Builder, and not find any plugin (linked or not). We workaround
  // this by using the CWD here.
  //
  // This is not ideal, but the only reason to link Builder is testing.
  if (
    from === undefined &&
    getExecutionMode() === ExecutionMode.EXECUTION_MODE_LINKED
  ) {
    from = process.cwd();

    log("Builder is linked, searching for plugin starting from CWD", from);
  }

  let globalFlag = "";
  let globalWarning = "";
  if (getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION) {
    globalFlag = " --global";
    globalWarning =
      "You are using a global installation of Builder. Plugins and their dependencies must also be global.\n";
  }

  const pluginPackageJson = readPackageJson(pluginName, from);

  if (pluginPackageJson === undefined) {
    const installExtraFlags = globalFlag;

    throw new BuilderError(ERRORS.PLUGINS.NOT_INSTALLED, {
      plugin: pluginName,
      extraMessage: globalWarning,
      extraFlags: installExtraFlags,
    });
  }

  // We use the package.json's version of the name, as it is normalized.
  pluginName = pluginPackageJson.name;

  if (builderContext.loadedPlugins.includes(pluginName)) {
    return;
  }

  if (pluginPackageJson.peerDependencies !== undefined) {
    for (const [dependencyName, versionSpec] of Object.entries(
      pluginPackageJson.peerDependencies
    )) {
      const dependencyPackageJson = readPackageJson(dependencyName, from);

      let installExtraFlags = globalFlag;

      if (versionSpec.match(/^[0-9]/) !== null) {
        installExtraFlags += " --save-exact";
      }

      if (dependencyPackageJson === undefined) {
        throw new BuilderError(ERRORS.PLUGINS.MISSING_DEPENDENCY, {
          plugin: pluginName,
          dependency: dependencyName,
          extraMessage: globalWarning,
          extraFlags: installExtraFlags,
          versionSpec,
        });
      }

      const installedVersion = dependencyPackageJson.version;

      if (
        !semver.satisfies(installedVersion, versionSpec, {
          includePrerelease: true,
        })
      ) {
        throw new BuilderError(ERRORS.PLUGINS.DEPENDENCY_VERSION_MISMATCH, {
          plugin: pluginName,
          dependency: dependencyName,
          extraMessage: globalWarning,
          extraFlags: installExtraFlags,
          versionSpec,
          installedVersion,
        });
      }
    }
  }

  const options = from !== undefined ? { paths: [from] } : undefined;
  const pluginPath = require.resolve(pluginName, options);
  loadPluginFile(pluginPath);

  builderContext.setPluginAsLoaded(pluginName);
}

export function loadPluginFile(absolutePluginFilePath: string) {
  log("Loading plugin file %s", absolutePluginFilePath);
  const imported = require(absolutePluginFilePath);
  const plugin = imported.default !== undefined ? imported.default : imported;
  if (typeof plugin === "function") {
    plugin();
  }
}

export function readPackageJson(
  packageName: string,
  from?: string
): PackageJson | undefined {
  try {
    const options = from !== undefined ? { paths: [from] } : undefined;
    const packageJsonPath = require.resolve(
      path.join(packageName, "package.json"),
      options
    );

    return require(packageJsonPath);
  } catch (error) {
    return undefined;
  }
}

export function ensurePluginLoadedWithUsePlugin() {
  // No-op. Only here for backwards compatibility
}
