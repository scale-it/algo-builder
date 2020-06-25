import debug from "debug";

import { BuilderRuntimeEnvironment } from "../../types";
import { BuilderContext } from "../context";
import { loadConfigAndTasks } from "../core/config/config-loading";
import { BuilderError } from "../core/errors";
import { ERRORS } from "../core/errors-list";
import { BUILDER_PARAM_DEFINITIONS } from "../core/params/builder-params";
import { getEnvBuilderArguments } from "../core/params/env-variables";
import { Environment } from "../core/runtime-environment";

let ctx: BuilderContext;
let env: BuilderRuntimeEnvironment;

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

  const builderArguments = getEnvBuilderArguments(
    BUILDER_PARAM_DEFINITIONS,
    process.env
  );

  if (builderArguments.verbose) {
    debug.enable("builder*");
  }

  const config = loadConfigAndTasks(builderArguments);

  // TODO: This is here for backwards compatibility.
  // There are very few projects using this.
  if (builderArguments.network === undefined) {
    builderArguments.network = config.defaultNetwork;
  }

  env = new Environment(
    config,
    builderArguments,
    ctx.tasksDSL.getTaskDefinitions(),
    ctx.extendersManager.getExtenders()
  );

  ctx.setBuilderRuntimeEnvironment(env);
}

export = env;
