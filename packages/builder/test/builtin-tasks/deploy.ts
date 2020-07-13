import { assert } from "chai";
import * as fsExtra from "fs-extra";
import fs from "fs";
import sinon from "sinon";

import { ERRORS } from "../../src/internal/core/errors-list";
import { expectBuilderErrorAsync } from "../helpers/errors";
import { useCleanFixtureProject, testFixtureOutputFile } from "../helpers/project";
import { TASK_CLEAN, TASK_DEPLOY } from "../../src/builtin-tasks/task-names";
import { AlgobRuntimeEnv } from "../../src/types";

describe("Deploy task", function () {
  useCleanFixtureProject("scripts-dir")

  it("Should execute the tasks", async function () {
    await this.env.run(TASK_DEPLOY, { noCompile: true });
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
`);
  });

  it("Should allow to specify scripts, preserving order", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["other-scripts/1.js", "scripts/2.js", "scripts/1.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `other scripts directory: script 1 executed
scripts directory: script 2 executed
scripts directory: script 1 executed
`);
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;
  });

  it("Should short-circuit and return failed script's status code", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_DEPLOY, { fileNames: ["other-scripts/1.js", "failing.js", "scripts/1.js"] }),
      ERRORS.BUILTIN_TASKS.EXECUTION_ERROR
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `other scripts directory: script 1 executed
failing scripts: script failed
`);
    assert.equal(process.exitCode, 123);
    (process as any).exitCode = undefined;
  });

});

describe("Deploy task: empty scripts dir", function () {
  useCleanFixtureProject("scripts-dir-empty")

  it("Should complain about no scripts", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_DEPLOY, {}),
      ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND
    );
  });
});

describe("Deploy task: no scripts dir", function () {
  useCleanFixtureProject("scripts-dir-none")

  it("Should complain about nonexistent directory", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_DEPLOY, { directory: "nonexistent-dir" }),
      ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND
    );
  });
});
