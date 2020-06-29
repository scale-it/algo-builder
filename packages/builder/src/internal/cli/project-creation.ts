import chalk from "chalk";
import fsExtra from "fs-extra";
import os from "os";
import path from "path";

import { BUILDER_NAME } from "../constants";
import { ExecutionMode, getExecutionMode } from "../core/execution-mode";
import { getPackageJson, getPackageRoot } from "../util/package-info";

import { BuilderError } from "../core/errors";
import { ERRORS } from "../core/errors-list"

const SAMPLE_PROJECT_DEPENDENCIES = [
  "chai",
];

async function removeProjectDirIfPresent(projectRoot: string, dirName: string) {
  const dirPath = path.join(projectRoot, dirName);
  if (await fsExtra.pathExists(dirPath)) {
    await fsExtra.remove(dirPath);
  }
}

async function printWelcomeMessage() {
  const packageJson = await getPackageJson();

  console.log(
    chalk.cyan(`Welcome to ${BUILDER_NAME} v${packageJson.version}`));
}

async function copySampleProject(location: string) {
  const packageRoot = await getPackageRoot();

  const sampleProjDir = path.join(packageRoot, "sample-project")

  console.log(chalk.greenBright("Initializing new workspace in " + process.cwd() + "."))

  return await fsExtra.copySync(sampleProjDir, location, {
    // User doesn't choose the directory so overwrite should be avoided
    overwrite: false,
    filter: (src: string, dest: string) => {
      const relPath = path.relative(process.cwd(), dest)
      if (relPath === '') {
        return true
      }
      if (path.basename(dest) === ".gitkeep") {
        return false
      }
      if (fsExtra.pathExistsSync(dest)) {
        throw new BuilderError(ERRORS.GENERAL.INIT_INSIDE_PROJECT, {
          clashingFile: relPath
        });
      }
      return true
    }
  })
}

function printSuggestedCommands() {
  const npx =
    getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION
      ? ""
      : "npx ";

  console.log(`Try running some of the following tasks:`);
  console.log(`  ${npx}builder accounts`);
  console.log(`  ${npx}builder compile`);
  console.log(`  ${npx}builder test`);
  console.log(`  ${npx}builder node`);
  console.log(`  node scripts/sample-script.js`);
  console.log(`  ${npx}builder help`);
}

async function printTrufflePluginInstallationInstructions() {
  console.log(
    `You need to install these dependencies to run the sample project:`
  );

  const cmd = await getRecommendedDependenciesInstallationCommand();

  console.log(`  ${cmd.join(" ")}`);
}

async function writeEmptyBuilderConfig() {
  return fsExtra.writeFile(
    "builder.config.js",
    "module.exports = {};\n",
    "utf-8"
  );
}

export async function createProject(location: string) {
  await printWelcomeMessage();

  await copySampleProject(location);

  let shouldShowInstallationInstructions = true;

  if (await canInstallTrufflePlugin()) {
    const installedRecommendedDeps = SAMPLE_PROJECT_DEPENDENCIES.filter(
      isInstalled
    );

    if (
      installedRecommendedDeps.length === SAMPLE_PROJECT_DEPENDENCIES.length
    ) {
      shouldShowInstallationInstructions = false;
    } else if (installedRecommendedDeps.length === 0) {
      const shouldInstall = await confirmTrufflePluginInstallation();
      if (shouldInstall) {
        const installed = await installRecommendedDependencies();

        if (!installed) {
          console.warn(
            chalk.red("Failed to install the sample project's dependencies")
          );
        }

        shouldShowInstallationInstructions = !installed;
      }
    }
  }

  if (shouldShowInstallationInstructions) {
    console.log(``);
    await printTrufflePluginInstallationInstructions();
  }

  console.log("\n✨ ", chalk.cyan("Project created"), " ✨\n");

  printSuggestedCommands();
}

function createConfirmationPrompt(name: string, message: string) {
  return {
    type: "confirm",
    name,
    message,
    initial: "y",
    default: "(Y/n)",
    isTrue(input: string | boolean) {
      if (typeof input === "string") {
        return input.toLowerCase() === "y";
      }

      return input;
    },
    isFalse(input: string | boolean) {
      if (typeof input === "string") {
        return input.toLowerCase() === "n";
      }

      return input;
    },
    format(): string {
      const that = this as any;
      const value = that.value === true ? "y" : "n";

      if (that.state.submitted === true) {
        return that.styles.submitted(value);
      }

      return value;
    },
  };
}

async function canInstallTrufflePlugin() {
  return (
    (await fsExtra.pathExists("package.json")) &&
    (getExecutionMode() === ExecutionMode.EXECUTION_MODE_LOCAL_INSTALLATION ||
      getExecutionMode() === ExecutionMode.EXECUTION_MODE_LINKED) &&
    // TODO: Figure out why this doesn't work on Win
    os.type() !== "Windows_NT"
  );
}

function isInstalled(dep: string) {
  const packageJson = fsExtra.readJSONSync("package.json");

  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
  };

  return dep in allDependencies;
}

async function isYarnProject() {
  return fsExtra.pathExists("yarn.lock");
}

async function installRecommendedDependencies() {
  console.log("");
  const installCmd = await getRecommendedDependenciesInstallationCommand();
  return installDependencies(installCmd[0], installCmd.slice(1));
}

async function confirmTrufflePluginInstallation(): Promise<boolean> {
  const { default: enquirer } = await import("enquirer");

  let responses: {
    shouldInstallPlugin: boolean;
  };

  const packageManager = (await isYarnProject()) ? "yarn" : "npm";

  try {
    responses = await enquirer.prompt([
      createConfirmationPrompt(
        "shouldInstallPlugin",
        `Do you want to install the sample project's dependencies with ${packageManager} (${SAMPLE_PROJECT_DEPENDENCIES.join(
          " "
        )})?`
      ),
    ]);
  } catch (e) {
    if (e === "") {
      return false;
    }

    // tslint:disable-next-line only-builder-error
    throw e;
  }

  return responses.shouldInstallPlugin === true;
}

async function installDependencies(
  packageManager: string,
  args: string[]
): Promise<boolean> {
  const { spawn } = await import("child_process");

  console.log(`${packageManager} ${args.join(" ")}`);

  const childProcess = spawn(packageManager, args, {
    stdio: "inherit" as any, // There's an error in the TS definition of ForkOptions
  });

  return new Promise<boolean>((resolve, reject) => {
    childProcess.once("close", (status) => {
      childProcess.removeAllListeners("error");

      if (status === 0) {
        resolve(true);
        return;
      }

      reject(false);
    });

    childProcess.once("error", (status) => {
      childProcess.removeAllListeners("close");
      reject(false);
    });
  });
}

async function getRecommendedDependenciesInstallationCommand(): Promise<
  string[]
> {
  const isGlobal =
    getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION;

  if (!isGlobal && (await isYarnProject())) {
    return ["yarn", "add", "--dev", ...SAMPLE_PROJECT_DEPENDENCIES];
  }

  const npmInstall = ["npm", "install"];

  if (isGlobal) {
    npmInstall.push("--global");
  }

  return [...npmInstall, "--save-dev", ...SAMPLE_PROJECT_DEPENDENCIES];
}
