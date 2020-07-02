/**
 * This function resets the builder context.
 *
 * This doesn't unload any loaded Builder plugin, so those have to be unloaded
 * manually with `unloadModule`.
 */
import { BuilderContext } from "./context";
import { getUserConfigPath } from "./core/project-structure";
//import { globSync } from "./util/glob";

export function resetBuilderContext(): void {
  if (BuilderContext.isCreated()) {
    const ctx = BuilderContext.getBuilderContext();
    const globalAsAny = global as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (ctx.environment !== undefined) {
      for (const key of Object.keys(ctx.environment)) {
        globalAsAny[key] = undefined;
      }
      // unload config file too.
      if (ctx.environment.config.paths) {
        unloadModule(ctx.environment.config.paths.configFile);
      }
    } else {
      // We may get here if loading the config has thrown, so be unload it
      let configPath: string | undefined;

      try {
        configPath = getUserConfigPath();
      } catch (error) {
        // We weren't in a builder project
      }

      if (configPath !== undefined) {
        unloadModule(configPath);
      }
    }
    BuilderContext.deleteBuilderContext();
  }

  // Unload all the builder's entry-points.
  unloadModule("../register");
  unloadModule("./cli/cli");
  unloadModule("./lib/lib");
}

function unloadModule(path: string) {
  try {
    delete require.cache[require.resolve(path)];
  } catch (err) {
    // module wasn't loaded
  }
}
