import * as fs from "fs";
import path from "path";

/**
 * This helper adds mocha hooks to run the tests inside one of the projects
 * from test/integration-test-files.
 *
 * @param filename The base name of the folder with the integration files to use.
 */
export function useIntegrationFile (filename: string): void {
  let filePath: string;
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

export function getIntegrationFilePath (
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
