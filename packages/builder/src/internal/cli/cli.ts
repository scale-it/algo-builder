#!/usr/bin/env node
// -*- mode: typescript -*- // https://github.com/syl20bnr/spacemacs/issues/13715
import chalk from "chalk";
import debug from "debug";
import semver from "semver";
import "source-map-support/register";

import { TASK_HELP } from "../../builtin-tasks/task-names";
import { TaskArguments } from "../../types";
import { BUILDER_NAME } from "../constants";
import { BuilderContext } from "../context";
import { loadConfigAndTasks } from "../core/config/config-loading";
import { BuilderError, BuilderPluginError } from "../core/errors";
import { ERRORS, getErrorCode } from "../core/errors-list";
import { BUILDER_PARAM_DEFINITIONS } from "../core/params/builder-params";
import { getEnvBuilderArguments } from "../core/params/env-variables";
import { isCwdInsideProject } from "../core/project-structure";
import { Environment } from "../core/runtime-environment";
import { loadTsNodeIfPresent } from "../core/typescript-support";
import { getPackageJson, PackageJson } from "../util/package-info";

//import { Analytics } from "./analytics";
import { ArgumentsParser } from "./arguments-parser";
import { enableEmoji } from "./emoji";
import { createProject } from "./project-creation";

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

async function main() {
  // We first accept this argument anywhere, so we know if the user wants
  // stack traces before really parsing the arguments.
  let showStackTraces = process.argv.includes("--show-stack-traces");

  try {
    const packageJson = await getPackageJson();

    ensureValidNodeVersion(packageJson);

    const envVariableArguments = getEnvBuilderArguments(
      BUILDER_PARAM_DEFINITIONS,
      process.env
    );

    const argumentsParser = new ArgumentsParser();

    const {
      builderArguments,
      taskName: parsedTaskName,
      unparsedCLAs,
    } = argumentsParser.parseBuilderArguments(
      BUILDER_PARAM_DEFINITIONS,
      envVariableArguments,
      process.argv.slice(2)
    );

    if (builderArguments.verbose) {
      debug.enable("builder*");
    }

    //if (builderArguments.emoji) {
    //  enableEmoji();
    //}

    showStackTraces = builderArguments.showStackTraces;

    if (
      builderArguments.config === undefined &&
      !isCwdInsideProject() &&
      process.stdout.isTTY === true
    ) {
      await createProject();
      return;
    }

    // --version is a special case
    if (builderArguments.version) {
      await printVersionMessage(packageJson);
      return;
    }

    loadTsNodeIfPresent();

    const ctx = BuilderContext.createBuilderContext();
    const config = loadConfigAndTasks(builderArguments);

    //const analytics = await Analytics.getInstance(
    //  config.paths.root,
    //  config.analytics.enabled
    //);

    const envExtenders = ctx.extendersManager.getExtenders();
    const taskDefinitions = ctx.tasksDSL.getTaskDefinitions();

    let taskName = parsedTaskName !== undefined ? parsedTaskName : "help";

    //// tslint:disable-next-line: prefer-const
    //let [abortAnalytics, hitPromise] = await analytics.sendTaskHit(taskName);

    let taskArguments: TaskArguments;

    // --help is a also special case
    if (builderArguments.help && taskName !== TASK_HELP) {
      taskArguments = { task: taskName };
      taskName = TASK_HELP;
    } else {
      const taskDefinition = taskDefinitions[taskName];

      if (taskDefinition === undefined) {
        throw new BuilderError(ERRORS.ARGUMENTS.UNRECOGNIZED_TASK, {
          task: taskName,
        });
      }

      taskArguments = argumentsParser.parseTaskArguments(
        taskDefinition,
        unparsedCLAs
      );
    }

    // TODO: This is here for backwards compatibility
    // There are very few projects using this.
    if (builderArguments.network === undefined) {
      builderArguments.network = config.defaultNetwork;
    }

    const env = new Environment(
      config,
      builderArguments,
      taskDefinitions,
      envExtenders
    );

    ctx.setBuilderRuntimeEnvironment(env);

    const timestampBeforeRun = new Date().getTime();

    await env.run(taskName, taskArguments);

    const timestampAfterRun = new Date().getTime();
    //if (
    //  timestampAfterRun - timestampBeforeRun >
    //  ANALYTICS_SLOW_TASK_THRESHOLD
    //) {
    //  await hitPromise;
    //} else {
    //  abortAnalytics();
    //}
    log(`Killing Builder after successfully running task ${taskName}`);
  } catch (error) {
    let isBuilderError = false;

    if (BuilderError.isBuilderError(error)) {
      isBuilderError = true;
      console.error(chalk.red(`Error ${error.message}`));
    } else if (BuilderPluginError.isBuilderPluginError(error)) {
      isBuilderError = true;
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

    if (showStackTraces) {
      console.error(error.stack);
    } else {
      if (!isBuilderError) {
        console.error(
          `If you think this is a bug in Builder, please report it here: https://builder.dev/reportbug`
        );
      }

      if (BuilderError.isBuilderError(error)) {
        const link = `https://builder.dev/${getErrorCode(
          error.errorDescriptor
        )}`;

        console.error(
          `For more info go to ${link} or run ${BUILDER_NAME} with --show-stack-traces`
        );
      } else {
        console.error(
          `For more info run ${BUILDER_NAME} with --show-stack-traces`
        );
      }
    }

    process.exit(1);
  }
}

main()
  .then(() => process.exit(process.exitCode))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
