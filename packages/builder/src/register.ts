import debug from "debug";

import { BuilderContext } from "./internal/context";
import { loadConfigAndTasks } from "./internal/core/config/config-loading";
import { ALGOB_PARAM_DEFINITIONS } from "./internal/core/params/builder-params";
import { getEnvRuntimeArgs } from "./internal/core/params/env-variables";
import { Environment } from "./internal/core/runtime-environment";
import {
  disableReplWriterShowProxy,
  isNodeCalledWithoutAScript
} from "./internal/util/console";

if (!BuilderContext.isCreated()) {
  require("source-map-support/register");

  const ctx = BuilderContext.createBuilderContext();

  if (isNodeCalledWithoutAScript()) {
    disableReplWriterShowProxy();
  }

  const runtimeArgs = getEnvRuntimeArgs(
    ALGOB_PARAM_DEFINITIONS,
    process.env
  );

  if (runtimeArgs.verbose) {
    debug.enable("builder*");
  }

  const config = loadConfigAndTasks(runtimeArgs);

  if (!runtimeArgs.network) {
    runtimeArgs.network = "default";
  }

  const env = new Environment(
    config,
    runtimeArgs,
    ctx.tasksDSL.getTaskDefinitions(),
    ctx.extendersManager.getExtenders()
  );

  ctx.setAlgobRuntimeEnv(env);

  env.injectToGlobal();
}
