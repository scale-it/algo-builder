#!/usr/bin/env node
// -*- mode: typescript -*- // https://github.com/syl20bnr/spacemacs/issues/13715
import "source-map-support/register";

import chalk from "chalk";
import debug from "debug";
import semver from "semver";

import { TASK_HELP, TASK_INIT } from "../../builtin-tasks/task-names";
import { TaskArguments } from "../../types";
import { ALGOB_NAME } from "../constants";
import { BuilderContext } from "../context";
import { loadConfigAndTasks } from "../core/config/config-loading";
import { BuilderError, BuilderPluginError } from "../core/errors";
import { ERRORS } from "../core/errors-list";
import { ALGOB_PARAM_DEFINITIONS } from "../core/params/builder-params";
import { getEnvRuntimeArgs } from "../core/params/env-variables";
import { isCwdInsideProject } from "../core/project-structure";
import { Environment } from "../core/runtime-environment";
import { loadTsNodeIfPresent } from "../core/typescript-support";
import { getPackageJson, PackageJson } from "../util/package-info";
//import { Analytics } from "./analytics";
import { ArgumentsParser } from "./arguments-parser";
const log = debug("builder:core:cli");

//const ANALYTICS_SLOW_TASK_THRESHOLD = 300;

async function printVersionMessage(packageJson: PackageJson) {
  console.log(packageJson.version);
}

function ensureValidNodeVersion(packageJson: PackageJson) {
  const requirement = packageJson.engines.node;
  if (!semver.satisfies(process.version, requirement)) {
    throw new BuilderError(ERRORS.GENERAL.INVALID_NODE_VERSION, {
      requirement,
    });
  }
}

/* eslint-disable sonarjs/cognitive-complexity */
async function main() {
  // We first accept this argument anywhere, so we know if the user wants
  // stack traces before really parsing the arguments.
  let showStackTraces = process.argv.includes("--show-stack-traces");

  try {
    const packageJson = await getPackageJson();

    ensureValidNodeVersion(packageJson);

    const envVariableArguments = getEnvRuntimeArgs(
      ALGOB_PARAM_DEFINITIONS,
      process.env);

    const argumentsParser = new ArgumentsParser();
    const {
      runtimeArgs,
      taskName: parsedTaskName,
      unparsedCLAs,
    } = argumentsParser.parseRuntimeArgs(
      ALGOB_PARAM_DEFINITIONS,
      envVariableArguments,
      process.argv.slice(2)
    );

    if (runtimeArgs.verbose) {
      debug.enable("builder*");
    }

    showStackTraces = runtimeArgs.showStackTraces;

    // --version is a special case
    if (runtimeArgs.version) {
      await printVersionMessage(packageJson);
      return;
    }

    loadTsNodeIfPresent();

    const ctx = BuilderContext.createBuilderContext();
    const config = loadConfigAndTasks(runtimeArgs);

    //const analytics = await Analytics.getInstance(
    //  config.paths.root,
    //  config.analytics.enabled
    //);

    const envExtenders = ctx.extendersManager.getExtenders();
    const taskDefinitions = ctx.tasksDSL.getTaskDefinitions();

    //// tslint:disable-next-line: prefer-const
    //let [abortAnalytics, hitPromise] = await analytics.sendTaskHit(taskName);

    let taskName = parsedTaskName || TASK_HELP;

    if (!taskDefinitions[taskName]) {
      throw new BuilderError(ERRORS.ARGUMENTS.UNRECOGNIZED_TASK, {
        task: taskName,
      });
    }

    // Being inside of a project is non-mandatory for help and init
    if ((taskName !== TASK_HELP && taskName !== TASK_INIT && !runtimeArgs.help) &&
      !isCwdInsideProject()) {
      throw new BuilderError(ERRORS.GENERAL.NOT_INSIDE_PROJECT, {
        task: taskName,
      });
      return;
    }

    // --help is a also special case
    let taskArguments: TaskArguments;
    if (runtimeArgs.help && taskName !== TASK_HELP) {
      taskArguments = { task: taskName };
      taskName = TASK_HELP;
    } else {
      taskArguments = argumentsParser.parseTaskArguments(
        taskDefinitions[taskName],
        unparsedCLAs
      );
    }

    if (!runtimeArgs.network) {
      // TODO:RZ
      throw new Error("INTERNAL ERROR. Default network should be registered in `register.ts` module")
    }

    const env = new Environment(
      config,
      runtimeArgs,
      taskDefinitions,
      envExtenders
    );

    ctx.setAlgobRuntimeEnv(env);

    const tBeforeRun = new Date().getTime();  // eslint-disable-line @typescript-eslint/no-unused-vars

    await env.run(taskName, taskArguments);  // eslint-disable-line @typescript-eslint/no-unused-vars

    const tAfterRun = new Date().getTime();  // eslint-disable-line @typescript-eslint/no-unused-vars
    //if (tAfterRun - tBeforeRun > ANALYTICS_SLOW_TASK_THRESHOLD) {
    //  await hitPromise;
    //} else {
    //  abortAnalytics();
    //}
    log(`Killing Builder after successfully running task ${taskName}`);
  } catch (error) {
    if (BuilderError.isBuilderError(error)) {
      console.error(chalk.red(`Error ${error.message}`));
    } else if (BuilderPluginError.isBuilderPluginError(error)) {
      console.error(
        chalk.red(`Error in plugin ${error.pluginName}: ${error.message}`)
      );
    } else if (error instanceof Error) {
      console.error(chalk.red("An unexpected error occurred:"));
      showStackTraces = true;
    } else {
      console.error(chalk.red("An unexpected error occurred."));
      showStackTraces = true;
    }

    console.log("");

    if (showStackTraces)
      console.error(error.stack);
    else
      console.error(`For more info run ${ALGOB_NAME} with --show-stack-traces or add --help to display task-specific help.`);

    process.exit(1);
  }
}

main()
  .then(() => process.exit(process.exitCode))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
