import path from "path";
import util from "util";

import { internalTask } from "../internal/core/config/config-env";
import { AlgobRuntimeEnv } from "../types";

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
    .setAction(runTests);
}

async function runTests({ testFiles }: { testFiles: string[] }, { config }: AlgobRuntimeEnv) {
  if (testFiles.length !== 0) {
    return testFiles;
  }
  if (!config.paths) {
    throw new Error("unexpected non-project execution")
  }

  return glob(path.join(config.paths.tests, "**/*.js"));
}
