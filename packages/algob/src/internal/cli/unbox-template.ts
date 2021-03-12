import chalk from "chalk";
import enquirer from "enquirer";
import fse from "fs-extra";
import path from "path";

import { copyTemplatetoDestination, fetchRepository, setUpTempDirectory } from "../util/unpack";
import { createConfirmationPrompt, installDependencies, printSuggestedAlgobCommands, printWelcomeMessage } from "./project-creation";

const ALGOB_DAPP_TEMPLATES_GIT_REMOTE = 'scale-it/algorand-builder-templates';
const DEFAULT_DAPP_TEMPLATE = 'bare';

function isYarnProject (destination: string): boolean {
  return fse.existsSync(path.join(destination, "yarn.lock"));
}

async function confirmDepInstallation (name: string, destination: string): Promise<boolean> {
  const { default: enquirer } = await import("enquirer");

  let responses: {
    shouldInstall: boolean
  };

  const packageManager = isYarnProject(destination) ? "yarn" : "npm";

  try {
    responses = await enquirer.prompt([
      createConfirmationPrompt(
        "shouldInstall",
        `Do you want to install dapp template ${name}'s dependencies with ${packageManager} ?`
      )
    ]);
  } catch (e) {
    if (e === "") {
      return false;
    }

    throw e;
  }

  return responses.shouldInstall;
}

async function checkDir (destination: string, force: boolean): Promise<void> {
  if (!force) {
    const unboxDir = fse.readdirSync(destination);
    let responses: {
      shouldProceedWithNonEmptyDir: boolean
    };

    if (unboxDir.length) {
      console.log(`This directory is non-empty...`);
      try {
        responses = await enquirer.prompt([
          createConfirmationPrompt(
            "shouldProceedWithNonEmptyDir",
            `Do you want to proceed with the unboxing?`
          )
        ]);
      } catch (e) {
        if (e === "") {
          return;
        }

        throw e;
      }
      if (!responses.shouldProceedWithNonEmptyDir) {
        console.log("Unbox cancelled");
        process.exit();
      }
    }
  }
}

async function checkTemplateExists (basePath: string, templateName: string): Promise<[string, string]> {
  const templatePath = path.join(basePath, templateName);
  if (fse.existsSync(templatePath)) { return [templatePath, templateName]; } else {
    console.log(chalk.red(`Error occurred: template "${templateName}" does not exist in ${ALGOB_DAPP_TEMPLATES_GIT_REMOTE}`));
    const prompt = new (enquirer as any).Select({
      name: 'Select an option',
      message: 'Do you want to pick an existing template or exit?',
      choices: ['Pick an existing template', 'exit']
    });
    const response = await prompt.run();
    if (response === 'exit') {
      console.log("Unbox cancelled");
      process.exit();
    } else {
      const dApps = fse.readdirSync(basePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const dappsPrompt = new (enquirer as any).Select({
        name: 'dapps',
        message: 'Pick a template',
        choices: dApps
      });
      const selectedDapp = await dappsPrompt.run();
      return [path.join(basePath, selectedDapp), selectedDapp];
    }
  }
}

function _normalizeDestination (destination?: string): string {
  const workingDirectory = process.cwd();
  if (!destination) {
    return workingDirectory;
  }

  if (path.isAbsolute(destination)) return destination;
  return path.join(workingDirectory, destination);
};

// commands to start and build the react app
function printSuggestedDAppCommands (packageManager: string): void {
  console.log(`To use the react app, try running:`);
  console.log(`  ${packageManager} start`);
  console.log(`  ${packageManager} build`);
}

export async function unbox ({ force, destination, templateName }:
{ force: boolean, destination: string | undefined, templateName: string | undefined }): Promise<void> {
  await printWelcomeMessage();

  const normalizedDestination = _normalizeDestination(destination);
  fse.ensureDirSync(normalizedDestination);
  await checkDir(normalizedDestination, force);

  const tempDir = await setUpTempDirectory();
  const tempDirPath = tempDir.path;
  console.log('-> ', tempDirPath);
  const tempDirCleanup = tempDir.cleanupCallback;

  console.info(`* Fetching dapp-templates from ${ALGOB_DAPP_TEMPLATES_GIT_REMOTE} *`);
  await fetchRepository(ALGOB_DAPP_TEMPLATES_GIT_REMOTE, tempDirPath);
  if (templateName === undefined) { templateName = DEFAULT_DAPP_TEMPLATE; }
  let templatePath;
  [templatePath, templateName] = await checkTemplateExists(tempDirPath, templateName);

  await copyTemplatetoDestination(templatePath, normalizedDestination, force);
  tempDirCleanup();

  console.log(
    chalk.cyan(`\n★ Template ${templateName} initialized in ${normalizedDestination} ★\n`));

  const shouldInstallDependencies = await confirmDepInstallation(templateName, normalizedDestination);
  const packageManager = isYarnProject(normalizedDestination) ? "yarn" : "npm";
  let shouldShowInstallationInstructions;
  if (shouldInstallDependencies) {
    const installed = await installDependencies(packageManager, ['install'], normalizedDestination);
    if (!installed) {
      console.warn(
        chalk.red("Failed to install the sample project's dependencies")
      );
    }
    shouldShowInstallationInstructions = !installed;
  } else {
    shouldShowInstallationInstructions = true;
  }

  if (shouldShowInstallationInstructions) {
    console.log(
      chalk.yellow(`\nInstall your project dependencies using '${packageManager} install'`)
    );
  }
  printSuggestedAlgobCommands();
  printSuggestedDAppCommands(packageManager);
}
