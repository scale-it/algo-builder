import glob from "glob";
import path from "path";

import { internalTask } from "../internal/core/config/config-env";
import type { AlgobRuntimeEnv, ResolvedAlgobConfig } from "../types";
import { TaskArgs } from "./deploy";
import {
  TASK_TEST_GET_TEST_FILES,
} from "./task-names";


export default function () : void {
  internalTask(TASK_TEST_GET_TEST_FILES)
    .addOptionalVariadicPositionalParam(
      "filenames",
      "An optional list of files to test",
      []
    )
    .setAction(runTests);
}

function loadFiles(fileNames: string[], config: ResolvedAlgobConfig): string[]{
  if (fileNames.length !== 0) {
    return fileNames;
  }
  if (!config.paths) {
    throw new Error("unexpected non-project execution")
  }
  return glob.sync(path.join(config.paths.tests, "**/*.js")).sort();
}

async function runTests({ fileNames }: TaskArgs, { config }: AlgobRuntimeEnv): Promise<void> {
  const testfiles = loadFiles;
  console.log("Test files:", testfiles);
}
