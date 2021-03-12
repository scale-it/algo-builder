import chalk from "chalk";
import download from "download-git-repo";
import fse from "fs-extra";
import path from "path";
import tmp from "tmp";
import { promisify } from "util";

interface TmpI {
  path: string
  cleanupCallback: () => void
}

export async function setUpTempDirectory (): Promise<TmpI> {
  const options = {
    unsafeCleanup: true
  };
  try {
    const tmpDir = tmp.dirSync(options);
    return {
      path: path.join(tmpDir.name, "dapp-templates"),
      cleanupCallback: tmpDir.removeCallback
    };
  } catch (error) {
    console.error('Failed to unbox');
    throw error;
  }
}

async function promptOverwrites (
  contentCollisions: string[],
  destination: string
): Promise<string[]> {
  const { default: enquirer } = await import("enquirer");
  const overwriteContents = [];
  let response: {
    overwrite: boolean
  };

  for (const file of contentCollisions) {
    console.log(chalk.yellow(`${file} already exists in this directory..`));
    const overwriteToggle = [
      {
        type: "Toggle",
        name: "overwrite",
        message: `Overwrite ${file}?`,
        enabled: 'Yes',
        disabled: 'No'
      }
    ];

    response = await enquirer.prompt(overwriteToggle);
    if (response.overwrite) {
      fse.removeSync(`${destination}/${file}`);
      overwriteContents.push(file);
    }
  }

  return overwriteContents;
}

export async function copyTemplatetoDestination (
  tmpDir: string,
  destination: string,
  force: boolean
): Promise<void> {
  fse.ensureDirSync(destination);
  const templateContents = fse.readdirSync(tmpDir);
  const destinationContents = fse.readdirSync(destination);

  const newContents = templateContents.filter(
    filename => !destinationContents.includes(filename)
  );

  const contentCollisions = templateContents.filter(filename =>
    destinationContents.includes(filename)
  );

  let shouldCopy;
  if (force) {
    shouldCopy = templateContents;
  } else {
    const overwriteContents = await promptOverwrites(contentCollisions, destination);
    shouldCopy = [...newContents, ...overwriteContents];
  }

  for (const file of shouldCopy) {
    fse.copySync(`${tmpDir}/${file}`, `${destination}/${file}`);
  }
}

export async function fetchRepository (url: string, destination: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    await promisify(download)(url, destination);
  } catch (error) {
    console.error(`Failed to unbox ${url}`);
    throw error;
  }
}
