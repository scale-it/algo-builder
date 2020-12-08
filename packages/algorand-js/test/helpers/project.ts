import * as fs from "fs";
import path from "path";

export const testFixtureOutputFile = "output.txt";

/**
 * This helper adds mocha hooks to run the tests inside one of the projects
 * from test/fixture-projects.
 *
 * @param projectName The base name of the folder with the project to use.
 */
export function useFixtureProject (projectName: string): void {
  let projectPath: string;
  let prevWorkingDir: string;

  before(() => {
    projectPath = getFixtureProjectPath(projectName);
    prevWorkingDir = process.cwd();
    process.chdir(projectPath);
  });

  after(() => {
    process.chdir(prevWorkingDir);
  });
}

export function getFixtureProjectPath (
  projectName: string
): string {
  const projectPath = path.join(
    __dirname,
    "..",
    "fixture-projects",
    projectName
  );
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Fixture project ${projectName} doesn't exist`);
  }

  return fs.realpathSync(projectPath);
}
