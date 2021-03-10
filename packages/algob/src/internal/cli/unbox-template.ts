import fse from "fs-extra";
import path from "path";

import { createConfirmationPrompt } from "./project-creation";

const normalizeDestination = (destination?: string): string => {
  const workingDirectory = process.cwd();
  if (!destination) {
    return workingDirectory;
  }

  if (path.isAbsolute(destination)) return destination;
  return path.join(workingDirectory, destination);
};

async function checkDir (destination: string, force: boolean): Promise<void> {
  const { default: enquirer } = await import("enquirer");
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

export async function unbox ({ force, destination, templateName }:
{ force: boolean, destination: string | undefined, templateName: string | undefined }): Promise<void> {
  console.log('Force ', force);
  console.log('destination ', destination);
  console.log('name ', templateName);

  const normalizedDestination = normalizeDestination(destination);
  fse.ensureDirSync(normalizedDestination);
  await checkDir(normalizedDestination, force);

  console.log('W ', normalizedDestination);
}
