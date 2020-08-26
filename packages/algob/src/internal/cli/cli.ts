#!/usr/bin/env node
// -*- mode: typescript -*- // https://github.com/syl20bnr/spacemacs/issues/13715
import "source-map-support/register";

import chalk from "chalk";
import debug from "debug";
import semver from "semver";

import { TASK_HELP, TASK_INIT } from "../../builtin-tasks/task-names";
import { checkAlgorandUnauthorized } from "../../lib/exceptions";
import { AlgobRuntimeEnv, RuntimeArgs, TaskArguments } from "../../types";
import { ALGOB_NAME } from "../constants";
import { BuilderContext } from "../context";
import { loadConfigAndTasks } from "../core/config/config-loading";
import { BuilderError, BuilderPluginError } from "../core/errors";
import { ERRORS } from "../core/errors-list";
import {
  ALGOB_PARAM_DEFINITIONS,
  ALGOB_SHORT_PARAM_SUBSTITUTIONS
} from "../core/params/builder-params";
import { getEnvRuntimeArgs } from "../core/params/env-variables";
import { isCwdInsideProject } from "../core/project-structure";
import { Environment } from "../core/runtime-environment";
import { isSetupTask } from "../core/tasks/builtin-tasks";
import { getPackageJson, PackageJson } from "../util/package-info";
// import { Analytics } from "./analytics";
import { ArgumentsParser } from "./arguments-parser";

const log = debug("algob:core:cli");

// const ANALYTICS_SLOW_TASK_THRESHOLD = 300;

async function printVersionMessage (packageJson: PackageJson): Promise<void> {
  console.log(packageJson.version);
}

function ensureValidNodeVersion (packageJson: PackageJson): void {
  const requirement = packageJson.engines.node;
  if (!semver.satisfies(process.version, requirement)) {
    throw new BuilderError(ERRORS.GENERAL.INVALID_NODE_VERSION, {
      requirement
    });
  }
}

function printErrRecur (error: BuilderError): void {
  console.error(error.stack);
  if (error.parent) {
    if (error.parent instanceof BuilderError) {
      printErrRecur(error.parent);
    } else {
      console.error(error.parent);
    }
  }
}

function printStackTraces (showStackTraces: boolean, error: BuilderError): void {
  if (showStackTraces) {
    printErrRecur(error);
  } else {
    console.error(`For more info run ${ALGOB_NAME} with --show-stack-traces or add --help to display task-specific help.`);
  }
}

interface EnvAndArgs {
  env: AlgobRuntimeEnv
  taskName: string
  taskArguments: TaskArguments
}

interface RuntimeArgsAndPackageJson {
  runtimeArgs: RuntimeArgs
  unparsedCLAs: string[]
  maybeTaskName: string | undefined
  showStackTraces: boolean
  packageJson: PackageJson
  argumentsParser: ArgumentsParser
}

export async function gatherArguments (): Promise<RuntimeArgsAndPackageJson> {
  // We first accept this argument anywhere, so we know if the user wants
  // stack traces before really parsing the arguments.
  let showStackTraces = process.argv.includes("--show-stack-traces");

  const packageJson = await getPackageJson();

  ensureValidNodeVersion(packageJson);

  const envVariableArguments = getEnvRuntimeArgs(
    ALGOB_PARAM_DEFINITIONS,
    process.env);

  const argumentsParser = new ArgumentsParser();
  const {
    runtimeArgs,
    taskName: maybeTaskName,
    unparsedCLAs
  } = argumentsParser.parseRuntimeArgs(
    ALGOB_PARAM_DEFINITIONS,
    ALGOB_SHORT_PARAM_SUBSTITUTIONS,
    envVariableArguments,
    process.argv.slice(2)
  );

  if (runtimeArgs.verbose) {
    debug.enable("algob*");
  }

  showStackTraces = runtimeArgs.showStackTraces;

  return {
    runtimeArgs: runtimeArgs,
    unparsedCLAs: unparsedCLAs,
    maybeTaskName: maybeTaskName,
    showStackTraces: showStackTraces,
    packageJson: packageJson,
    argumentsParser: argumentsParser
  };
}

export async function loadEnvironmentAndArgs (
  maybeTaskName: string | undefined,
  runtimeArgs: RuntimeArgs,
  argumentsParser: ArgumentsParser,
  unparsedCLAs: string[]
): Promise<EnvAndArgs> {
  const ctx = BuilderContext.createBuilderContext();
  const config = loadConfigAndTasks(runtimeArgs);

  const envExtenders = ctx.extendersManager.getExtenders();
  const taskDefinitions = ctx.tasksDSL.getTaskDefinitions();

  let taskName = maybeTaskName ?? TASK_HELP;
  if (taskDefinitions[taskName] == null) {
    throw new BuilderError(ERRORS.ARGUMENTS.UNRECOGNIZED_TASK, {
      task: taskName
    });
  }
  const origTaskName = taskName;

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

  // we can't do it earlier because we above we need to check the special case with `--help`
  const isSetup = isSetupTask(taskName);

  // Being inside of a project is non-mandatory for help and init
  if (!isSetup && !isCwdInsideProject()) {
    throw new BuilderError(ERRORS.GENERAL.NOT_INSIDE_PROJECT, { task: origTaskName });
  }

  const env = new Environment(
    config,
    runtimeArgs,
    taskDefinitions,
    envExtenders,
    !isSetup);

  ctx.setAlgobRuntimeEnv(env);

  return {
    env: env,
    taskName: taskName,
    taskArguments: taskArguments
  };
}

/* eslint-disable sonarjs/cognitive-complexity */
async function main (): Promise<void> {
  // const analytics = await Analytics.getInstance(
  //  config.paths.root,
  //  config.analytics.enabled
  // );
  var showStackTraces = false;
  try {
    const {
      runtimeArgs,
      unparsedCLAs,
      showStackTraces: showStackTracesUpdate,
      packageJson,
      maybeTaskName,
      argumentsParser
    } = await gatherArguments();
    showStackTraces = showStackTracesUpdate;

    // --version is a special case
    if (runtimeArgs.version) {
      await printVersionMessage(packageJson);
      return;
    }

    const {
      env,
      taskName,
      taskArguments
    } = await loadEnvironmentAndArgs(
      maybeTaskName, runtimeArgs, argumentsParser, unparsedCLAs
    );

    // let [abortAnalytics, hitPromise] = await analytics.sendTaskHit(taskName);

    // const tBeforeRun = new Date().getTime();

    try {
      await env.run(taskName, taskArguments);
    } catch (e) {
      if (!checkAlgorandUnauthorized(e, env.network)) { throw e; }
    }

    // const tAfterRun = new Date().getTime();
    // if (tAfterRun - tBeforeRun > ANALYTICS_SLOW_TASK_THRESHOLD) {
    //  await hitPromise;
    // } else {
    //  abortAnalytics();
    // }
    log(`Quitting algob after successfully running task ${taskName}`);
  } catch (error) {
    if (BuilderError.isBuilderError(error)) {
      console.error(chalk.red(`Error ${error.message}`));
    } else if (BuilderPluginError.isBuilderPluginError(error)) {
      console.error(
        chalk.red(`Error in plugin ${error.pluginName ?? ""}: ${error.message}`)
      );
    } else if (error instanceof Error) {
      console.error(chalk.red("An unexpected error occurred:"), error.message);
      showStackTraces = true;
    } else {
      console.error(chalk.red("An unexpected error occurred."));
      showStackTraces = true;
    }

    console.log("");

    printStackTraces(showStackTraces, error);

    process.exit(1);
  }
}

main()
  .then(() => process.exit(process.exitCode))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
