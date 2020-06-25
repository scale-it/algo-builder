import { BuilderRuntimeEnvironment, ConfigExtender } from "../types";

import { ExtenderManager } from "./core/config/extenders";
import { BuilderError } from "./core/errors";
import { ERRORS } from "./core/errors-list";
import { TasksDSL } from "./core/tasks/dsl";

export type GlobalWithBuilderContext = NodeJS.Global & {
  __builderContext: BuilderContext;
};

export class BuilderContext {
  public static isCreated(): boolean {
    const globalWithBuilderContext = global as unknown as GlobalWithBuilderContext;
    return globalWithBuilderContext.__builderContext !== undefined;
  }

  public static createBuilderContext(): BuilderContext {
    if (this.isCreated()) {
      throw new BuilderError(ERRORS.GENERAL.CONTEXT_ALREADY_CREATED);
    }
    const globalWithBuilderContext = global as unknown as GlobalWithBuilderContext;
    const ctx = new BuilderContext();
    globalWithBuilderContext.__builderContext = ctx;
    return ctx;
  }

  public static getBuilderContext(): BuilderContext {
    const globalWithBuilderContext = global as unknown as GlobalWithBuilderContext;
    const ctx = globalWithBuilderContext.__builderContext;
    if (ctx === undefined) {
      throw new BuilderError(ERRORS.GENERAL.CONTEXT_NOT_CREATED);
    }
    return ctx;
  }

  public static deleteBuilderContext() {
    const globalAsAny = global as any;
    globalAsAny.__builderContext = undefined;
  }

  public readonly tasksDSL = new TasksDSL();
  public readonly extendersManager = new ExtenderManager();
  public environment?: BuilderRuntimeEnvironment;
  public readonly loadedPlugins: string[] = [];
  public readonly configExtenders: ConfigExtender[] = [];

  public setBuilderRuntimeEnvironment(env: BuilderRuntimeEnvironment) {
    if (this.environment !== undefined) {
      throw new BuilderError(ERRORS.GENERAL.CONTEXT_BRE_ALREADY_DEFINED);
    }
    this.environment = env;
  }

  public getBuilderRuntimeEnvironment(): BuilderRuntimeEnvironment {
    if (this.environment === undefined) {
      throw new BuilderError(ERRORS.GENERAL.CONTEXT_BRE_NOT_DEFINED);
    }
    return this.environment;
  }

  public setPluginAsLoaded(pluginName: string) {
    this.loadedPlugins.push(pluginName);
  }
}
