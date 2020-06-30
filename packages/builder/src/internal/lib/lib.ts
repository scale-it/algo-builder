import debug from "debug";

import { AlgobRuntimeEnv } from "../../types";
import { BuilderContext } from "../context";
import { loadConfigAndTasks } from "../core/config/config-loading";
import { BuilderError } from "../core/errors";
import { ERRORS } from "../core/errors-list";
import { ALGOB_PARAM_DEFINITIONS } from "../core/params/builder-params";
import { getEnvRuntimeArgs } from "../core/params/env-variables";
import { Environment } from "../core/runtime-environment";

let ctx: BuilderContext;
let env: AlgobRuntimeEnv;

if (BuilderContext.isCreated()) {
  ctx = BuilderContext.getBuilderContext();

  // The most probable reason for this to happen is that this file was imported
  // from the config file
  if (ctx.environment === undefined) {
    throw new BuilderError(ERRORS.GENERAL.LIB_IMPORTED_FROM_THE_CONFIG);
  }

  env = ctx.environment;
} else {
  ctx = BuilderContext.createBuilderContext();

  const runtimeArgs = getEnvRuntimeArgs(
    ALGOB_PARAM_DEFINITIONS,
    process.env
  );

  if (runtimeArgs.verbose) {
    debug.enable("builder*");
  }

  const config = loadConfigAndTasks(runtimeArgs);

  if (!runtimeArgs.network) {
    // TODO:RZ
    throw new Error("INTERNAL ERROR. Default network should be registered in `register.ts` module")
  }

  env = new Environment(
    config,
    runtimeArgs,
    ctx.tasksDSL.getTaskDefinitions(),
    ctx.extendersManager.getExtenders()
  );

  ctx.setAlgobRuntimeEnv(env);
}

export = env;
