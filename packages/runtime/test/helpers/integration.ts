import * as fs from "fs";
import path from "path";

/**
 * This helper adds mocha hooks to run the tests inside one of the projects in test/fixtures.
 * @param fixtureName: The base name of the folder in test/fixtures
 */
export function useFixture (fixtureName: string): void {
  let dirPath: string;
  let prevWorkingDir: string;

  before(() => {
    dirPath = getFixtureWorkingDir(fixtureName);
    prevWorkingDir = process.cwd();
    process.chdir(dirPath);
  });

  after(() => {
    process.chdir(prevWorkingDir);
  });
}

export function getFixtureWorkingDir (
  fixtureName: string
): string {
  const filePath = path.join(
    __dirname,
    "..",
    "fixtures",
    fixtureName
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture files ${fixtureName} doesn't exist`);
  }

  return fs.realpathSync(filePath);
}
