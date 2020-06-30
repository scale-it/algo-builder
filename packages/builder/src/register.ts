import debug from "debug";

import { BuilderContext } from "./internal/context";
import { loadConfigAndTasks } from "./internal/core/config/config-loading";
import { BUILDER_PARAM_DEFINITIONS } from "./internal/core/params/builder-params";
import { getEnvBuilderArguments } from "./internal/core/params/env-variables";
import { Environment } from "./internal/core/runtime-environment";
import { loadTsNodeIfPresent } from "./internal/core/typescript-support";
import {
  disableReplWriterShowProxy,
  isNodeCalledWithoutAScript,
} from "./internal/util/console";

if (!BuilderContext.isCreated()) {
  // tslint:disable-next-line no-var-requires
  require("source-map-support/register");

  const ctx = BuilderContext.createBuilderContext();

  if (isNodeCalledWithoutAScript()) {
    disableReplWriterShowProxy();
  }

  loadTsNodeIfPresent();

  const builderArguments = getEnvBuilderArguments(
    BUILDER_PARAM_DEFINITIONS,
    process.env
  );

  if (builderArguments.verbose) {
    debug.enable("builder*");
  }

  const config = loadConfigAndTasks(builderArguments);

  if (!builderArguments.network) {
    builderArguments.network = "default";
  }

  const env = new Environment(
    config,
    builderArguments,
    ctx.tasksDSL.getTaskDefinitions(),
    ctx.extendersManager.getExtenders()
  );

  ctx.setBuilderRuntimeEnvironment(env);

  env.injectToGlobal();
}
