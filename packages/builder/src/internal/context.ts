import { AlgobRuntimeEnv, ConfigExtender } from "../types";
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

  public static deleteBuilderContext() : void {
    (global as any).__builderContext = undefined;  // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  public readonly tasksDSL = new TasksDSL();
  public readonly extendersManager = new ExtenderManager();
  public environment?: AlgobRuntimeEnv;
  public readonly loadedPlugins: string[] = [];
  public readonly configExtenders: ConfigExtender[] = [];

  public setAlgobRuntimeEnv(env: AlgobRuntimeEnv) : void {
    if (this.environment !== undefined) {
      throw new BuilderError(ERRORS.GENERAL.CONTEXT_BRE_ALREADY_DEFINED);
    }
    this.environment = env;
  }

  public getAlgobRuntimeEnv(): AlgobRuntimeEnv {
    if (this.environment === undefined) {
      throw new BuilderError(ERRORS.GENERAL.CONTEXT_BRE_NOT_DEFINED);
    }
    return this.environment;
  }

  public setPluginAsLoaded(pluginName: string) : void {
    this.loadedPlugins.push(pluginName);
  }
}
