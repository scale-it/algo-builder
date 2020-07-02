import path from "path";
import util from "util";

import { internalTask } from "../internal/core/config/config-env";
import { isTypescriptSupported } from "../internal/core/typescript-support";

export async function glob(pattern: string): Promise<string[]> {
  const { default: globModule } = await import("glob");
  return util.promisify(globModule)(pattern, { realpath: true });
}

import {
  TASK_TEST_GET_TEST_FILES,
} from "./task-names";

export default function () : void {
  internalTask(TASK_TEST_GET_TEST_FILES)
    .addOptionalVariadicPositionalParam(
      "testFiles",
      "An optional list of files to test",
      []
    )
    .setAction(async ({ testFiles }: { testFiles: string[] }, { config }) => {
      if (testFiles.length !== 0) {
        return testFiles;
      }
      if (!config.paths) {
        throw new Error("unexpected non-project execution")
      }

      const jsFiles = await glob(path.join(config.paths.tests, "**/*.js"));

      if (!isTypescriptSupported()) {
        return jsFiles;
      }

      const tsFiles = await glob(path.join(config.paths.tests, "**/*.ts"));

      return [...jsFiles, ...tsFiles];
    });
}
