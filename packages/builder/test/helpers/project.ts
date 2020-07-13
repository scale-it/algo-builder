import * as fsExtra from "fs-extra";
import * as fs from "fs";
import path from "path";

import { useEnvironment } from "./environment";
import { TASK_CLEAN } from "../../src/builtin-tasks/task-names";
import { AlgobRuntimeEnv } from "../../src/types";

export const testFixtureOutputFile = "output.txt"

/**
 * This helper adds mocha hooks to run the tests inside one of the projects
 * from test/fixture-projects.
 *
 * @param projectName The base name of the folder with the project to use.
 */
export function useFixtureProject(projectName: string) {
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

export function getFixtureProjectPath(
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

/**
 * Creates a fresh copy of a fixture project, and uses it for test (as `useFixtureProject`).
 * The copied project name is `projecName + "-tmp"`. If it already exists an exception
 * is thrown.
 */
export function useFixtureProjectCopy(srcProjectName: string) {
  const project = srcProjectName + "-tmp";
  const srcProjectPath = getFixtureProjectPath(srcProjectName);
  const projectPath = path.join(srcProjectPath, "..", project);

  fsExtra.copySync(srcProjectPath, projectPath);
  useFixtureProject(project);

  after(() => fsExtra.removeSync(projectPath));
}

/**
 * Allows tests to interact with a clean fixture project.
 * Allows to inspect the output file after running the test by cleaning before running.
 */
export function useCleanFixtureProject(projectName: string) {
  useFixtureProject(projectName);
  useEnvironment((algobEnv: AlgobRuntimeEnv) => {
    return algobEnv.run(TASK_CLEAN, {});
  });

  beforeEach(function () {
    try {
      fs.unlinkSync(testFixtureOutputFile)
    } catch (err) {
      // ignored
    }
  })
}
