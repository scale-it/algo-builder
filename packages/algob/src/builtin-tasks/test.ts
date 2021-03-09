import Mocha from "mocha";

import { task } from "../internal/core/config/config-env";
import { testsDirectory } from "../lib/script-checkpoints";
import type { AlgobConfig } from "../types";
import { loadFilenames } from "./deploy";
import { TASK_TEST } from "./task-names";

async function runTests (config: AlgobConfig): Promise<void> {
  const testFiles = loadFilenames(testsDirectory);
  console.log("Test files:", testFiles);
  const mocha = new Mocha(config.mocha);
  // Adding test files to mocha object
  testFiles.forEach((file) => mocha.addFile(file));
  const testFailures = await new Promise<number>((resolve) => {
    mocha.run(resolve);
  });
  console.log(testFailures);
}

export default function (): void {
  task(TASK_TEST, "Run tests using mocha in project root")
    .setAction((config) => runTests(config));
}
