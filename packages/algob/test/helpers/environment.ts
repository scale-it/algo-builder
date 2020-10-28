import debug from "debug";

import { BuilderContext } from "../../src/internal/context";
import { loadConfigAndTasks } from "../../src/internal/core/config/config-loading";
import { BuilderError } from "../../src/internal/core/errors";
import { ERRORS } from "../../src/internal/core/errors-list";
import { ALGOB_PARAM_DEFINITIONS } from "../../src/internal/core/params/builder-params";
import { getEnvRuntimeArgs } from "../../src/internal/core/params/env-variables";
import { Environment } from "../../src/internal/core/runtime-environment";
import { resetBuilderContext } from "../../src/internal/reset";
import { AlgobRuntimeEnv, HttpNetworkConfig, NetworkConfig, PromiseAny } from "../../src/types";
import { account1 } from "../mocks/account";

declare module "mocha" {
  interface Context {
    env: AlgobRuntimeEnv
  }
}

let ctx: BuilderContext;

export const defaultNetCfg: HttpNetworkConfig = {
  accounts: [account1],
  host: "localhost",
  port: 8080,
  token: "some secret value"
};

export function useEnvironment (
  beforeEachFn?: (algobRuntimeEnv: AlgobRuntimeEnv) => PromiseAny
): void {
  beforeEach("Load environment", async function () {
    this.env = await getEnv(defaultNetCfg);
    if (beforeEachFn) {
      return await beforeEachFn(this.env);
    }
  });

  afterEach("reset builder context", function () {
    resetBuilderContext();
  });
}

export async function getEnv (defaultNetworkCfg?: NetworkConfig): Promise<AlgobRuntimeEnv> {
  if (BuilderContext.isCreated()) {
    ctx = BuilderContext.getBuilderContext();

    // The most probable reason for this to happen is that this file was imported
    // from the config file
    if (ctx.environment === undefined) {
      throw new BuilderError(ERRORS.GENERAL.LIB_IMPORTED_FROM_THE_CONFIG);
    }

    return ctx.environment;
  }

  ctx = BuilderContext.createBuilderContext();
  const runtimeArgs = getEnvRuntimeArgs(
    ALGOB_PARAM_DEFINITIONS,
    process.env
  );

  if (runtimeArgs.verbose) {
    debug.enable("algob*");
  }

  const config = await loadConfigAndTasks(runtimeArgs);

  if (runtimeArgs.network == null) {
    throw new Error("INTERNAL ERROR. Default network should be registered in `register.ts` module");
  }

  if (defaultNetworkCfg !== undefined) {
    config.networks.default = defaultNetworkCfg;
  }

  const env = new Environment(
    config,
    runtimeArgs,
    ctx.tasksDSL.getTaskDefinitions(),
    ctx.extendersManager.getExtenders(),
    true);
  ctx.setAlgobRuntimeEnv(env);

  return env;
}
