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
    filePath = getIntegrationFilePath(filename);
    prevWorkingDir = process.cwd();
    process.chdir(filePath);
  });

  after(() => {
    process.chdir(prevWorkingDir);
  });
}

export function getFixtureWorkingDir (
  filename: string
): string {
  const filePath = path.join(
    __dirname,
    "..",
    "integration-test-files",
    filename
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Integration files ${filename} doesn't exist`);
  }

  return fs.realpathSync(filePath);
}
