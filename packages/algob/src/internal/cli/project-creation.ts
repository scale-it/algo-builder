import chalk from "chalk";
import fsExtra from "fs-extra";
import os from "os";
import path from "path";

import type { PromiseAny } from "../../types";
import { ALGOB_NAME } from "../constants";
import { BuilderError } from "../core/errors";
import { ERRORS } from "../core/errors-list";
import { ExecutionMode, getExecutionMode } from "../core/execution-mode";
import { getPackageJson, getPackageRoot } from "../util/package-info";

const SAMPLE_PROJECT_DEPENDENCIES = [
  "chai"
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function removeProjectDirIfPresent (projectRoot: string, dirName: string): Promise<void> {
  const dirPath = path.join(projectRoot, dirName);
  if (await fsExtra.pathExists(dirPath)) {
    await fsExtra.remove(dirPath);
  }
}

export async function printWelcomeMessage (): Promise<void> {
  const packageJson = await getPackageJson();

  console.log(
    chalk.cyan(`★ Welcome to ${ALGOB_NAME} v${packageJson.version}`));
}

function copySampleProject (location: string): void {
  const packageRoot = getPackageRoot();
  const sampleProjDir = path.join(packageRoot, "sample-project");

  console.log(chalk.greenBright("Initializing new workspace in " + process.cwd() + "."));

  fsExtra.copySync(sampleProjDir, location, {
    // User doesn't choose the directory so overwrite should be avoided
    overwrite: false,
    filter: (src: string, dest: string) => {
      const relPath = path.relative(process.cwd(), dest);
      if (relPath === '') {
        return true;
      }
      if (path.basename(dest) === ".gitkeep") {
        return false;
      }
      if (fsExtra.pathExistsSync(dest)) {
        throw new BuilderError(ERRORS.GENERAL.INIT_INSIDE_PROJECT, {
          clashingFile: relPath
        });
      }
      return true;
    }
  });
}

export function printSuggestedCommands (): void {
  const npx =
    getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION
      ? ""
      : "npx ";

  console.log(`Try running some of the following tasks:`);
  console.log(`  ${npx}${ALGOB_NAME} gen-accounts`);
  console.log(`  ${npx}${ALGOB_NAME} compile`);
  console.log(`  ${npx}${ALGOB_NAME} test`);
  console.log(`  ${npx}${ALGOB_NAME} node-info`);
  console.log(`  node scripts/sample-script.js`);
  console.log(`  ${npx}${ALGOB_NAME} help`);
  console.log(`  ${npx}${ALGOB_NAME} console`);
}

async function printPluginInstallationInstructions (): Promise<void> {
  console.log(
    `You need to install these dependencies to run the sample project:`
  );

  const cmd = await npmInstallCmd();

  console.log(`  ${cmd.join(" ")}`);
}

export async function createProject (location: string): PromiseAny {
  await printWelcomeMessage();

  copySampleProject(location);

  let shouldShowInstallationInstructions = true;

  if (await canInstallPlugin()) {
    const installedRecommendedDeps = SAMPLE_PROJECT_DEPENDENCIES.filter(
      isInstalled
    );

    if (
      installedRecommendedDeps.length === SAMPLE_PROJECT_DEPENDENCIES.length
    ) {
      shouldShowInstallationInstructions = false;
    } else if (installedRecommendedDeps.length === 0) {
      const shouldInstall = await confirmPluginInstallation();
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

  console.log("\n★", chalk.cyan("Project created"), "★\n");

  if (shouldShowInstallationInstructions) {
    await printPluginInstallationInstructions();
    console.log(``);
  }

  printSuggestedCommands();
}

export function createConfirmationPrompt (name: string, message: string) { // eslint-disable-line @typescript-eslint/explicit-function-return-type
  return {
    type: "confirm",
    name,
    message,
    initial: "y",
    default: "(Y/n)",
    isTrue (input: string | boolean) {
      if (typeof input === "string") {
        return input.toLowerCase() === "y";
      }

      return input;
    },
    isFalse (input: string | boolean) {
      if (typeof input === "string") {
        return input.toLowerCase() === "n";
      }

      return input;
    },
    format (): string {
      const that = this as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const value = that.value === true ? "y" : "n";

      if (that.state.submitted === true) {
        return that.styles.submitted(value);
      }

      return value;
    }
  };
}

async function canInstallPlugin (): Promise<boolean> {
  return (
    (await fsExtra.pathExists("package.json")) &&
    (getExecutionMode() === ExecutionMode.EXECUTION_MODE_LOCAL_INSTALLATION ||
      getExecutionMode() === ExecutionMode.EXECUTION_MODE_LINKED) &&
    // TODO: Figure out why this doesn't work on Win
    os.type() !== "Windows_NT"
  );
}

function isInstalled (dep: string): boolean {
  const packageJson = fsExtra.readJSONSync("package.json");
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies
  };

  return dep in allDependencies;
}

function isYarnProject (): boolean {
  return fsExtra.pathExistsSync("yarn.lock");
}

async function installRecommendedDependencies (): Promise<boolean> {
  console.log("");
  const installCmd = await npmInstallCmd();
  return await installDependencies(installCmd[0], installCmd.slice(1));
}

async function confirmPluginInstallation (): Promise<boolean> {
  const { default: enquirer } = await import("enquirer");

  let responses: {
    shouldInstallPlugin: boolean
  };

  const packageManager = isYarnProject() ? "yarn" : "npm";

  try {
    responses = await enquirer.prompt([
      createConfirmationPrompt(
        "shouldInstallPlugin",
        `Do you want to install the sample project's dependencies with ${packageManager} (${SAMPLE_PROJECT_DEPENDENCIES.join(
          " "
        )})?`
      )
    ]);
  } catch (e) {
    if (e === "") {
      return false;
    }

    throw e;
  }

  return responses.shouldInstallPlugin;
}

export async function installDependencies (
  packageManager: string,
  args: string[],
  location?: string
): Promise<boolean> {
  const { spawn } = await import("child_process");

  console.log(`${packageManager} ${args.join(" ")}`);

  const childProcess = spawn(packageManager, args, {
    stdio: "inherit" as any, // eslint-disable-line @typescript-eslint/no-explicit-any,
    cwd: location
  });

  return await new Promise<boolean>((resolve, reject) => {
    childProcess.once("close", (status) => {
      childProcess.removeAllListeners("error");

      if (status === 0) {
        resolve(true);
        return;
      }

      reject(new Error("script process returned not 0 status"));
    });

    childProcess.once("error", (status) => {
      childProcess.removeAllListeners("close");
      reject(new Error("script process returned not 0 status"));
    });
  });
}

async function npmInstallCmd (): Promise<string[]> {
  const isGlobal =
    getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION;

  if (isYarnProject()) {
    const cmd = ["yarn"];
    if (isGlobal) { cmd.push("global"); }
    cmd.push("add", "--dev", ...SAMPLE_PROJECT_DEPENDENCIES);
    return cmd;
  }

  const npmInstall = ["npm", "install"];
  if (isGlobal) { npmInstall.push("--global"); }

  return [...npmInstall, "--save-dev", ...SAMPLE_PROJECT_DEPENDENCIES];
}
