import chalk from "chalk";
import enquirer from "enquirer";
import fse from "fs-extra";
import path from "path";

import { copyTemplatetoDestination, fetchRepository, setUpTempDirectory } from "../util/unpack";
import { createConfirmationPrompt, installDependencies, printSuggestedAlgobCommands, printWelcomeMessage } from "./project-creation";

const ALGOB_DAPP_TEMPLATES_GIT_REMOTE = 'scale-it/algo-builder-templates';
const DEFAULT_DAPP_TEMPLATE = 'default';

function isYarnProject (destination: string): boolean {
  return fse.existsSync(path.join(destination, "yarn.lock"));
}

/**
 * Confirm if user wants to install project dependencies in template directory
 * @param name Selected Dapp template name
 * @param destination location to initialize template
 */
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

/**
 * Checks if the destination directory is non-empty and confirm if the user
 * wants to proceed with the unboxing, skips if --force is used.
 * @param destination location to initialize template
 * @param force true if --force flag is used
 */
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

/**
 * Ensures that the template passed by user exists in scale-it/algo-builder-templates,
 * otherwise user can select a template from the existing templates or exit unboxing
 * @param basePath path to temporary directory (contains all dapp-templates)
 * @param templateName template name passed by user (bare if no template name is passed)
 */
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

/**
 * returns complete path (eg. "./" => current working directory)
 * @param destination base path
 */
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

/**
 * Unboxes a dapp template from 'scale-it/algo-builder-templates' with given name
 * and destination
 * @param force --force flag. If true then contents in destination directory are overwritten
 * @param templateName templateName to unbox from scale-it/algo-builder-templates.
 * @param destination destination directory to unbox template to. Defaults to current working directory
 *  - If template name is not passed, the default template is unboxed.
 *  - If template name passed is incorrect (template does not exist), then user is asked to unbox
 *     from one of the existing templates or exit unboxing
 *  - If there are conflicting files while copying template, then user is asked to overwrite each file
 *     or not (if --force is not used).
 *  - If `--force` is used, then conflicting files are overwritten.
 */
export async function unbox ({ force, templateName, destination }:
{ force: boolean, templateName?: string, destination?: string}): Promise<void> {
  await printWelcomeMessage();

  const normalizedDestination = _normalizeDestination(destination);
  fse.ensureDirSync(normalizedDestination);
  await checkDir(normalizedDestination, force);

  const tempDir = await setUpTempDirectory();
  const tempDirPath = tempDir.path;
  const tempDirCleanup = tempDir.cleanupCallback;

  console.info(`* Fetching dapp-templates from ${ALGOB_DAPP_TEMPLATES_GIT_REMOTE} *`);
  await fetchRepository(ALGOB_DAPP_TEMPLATES_GIT_REMOTE, tempDirPath);
  if (templateName === undefined) {
    console.log(`Template name not passed: using default template ${chalk.green(DEFAULT_DAPP_TEMPLATE)}`);
    templateName = DEFAULT_DAPP_TEMPLATE;
  }
  let templatePath;
  [templatePath, templateName] = await checkTemplateExists(tempDirPath, templateName);

  await copyTemplatetoDestination(templatePath, normalizedDestination, force);
  tempDirCleanup(); // clean temporary directory

  console.log(
    chalk.greenBright(`\n★ Template ${templateName} initialized in ${normalizedDestination} ★\n`));

  // install dependencies in /templatePath
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
