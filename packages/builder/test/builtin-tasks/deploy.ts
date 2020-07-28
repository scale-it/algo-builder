import { assert } from "chai";
import * as fs from "fs";

import { ERRORS } from "../../src/internal/core/errors-list";
import { expectBuilderErrorAsync } from "../helpers/errors";
import { useCleanFixtureProject, testFixtureOutputFile } from "../helpers/project";
import { TASK_DEPLOY } from "../../src/builtin-tasks/task-names";
import { loadFilenames } from "../../src/builtin-tasks/deploy";
import { loadCheckpoint } from "../../src/lib/script-checkpoints";

describe("Deploy task", function () {
  useCleanFixtureProject("scripts-dir")

  it("Should load scripts in the right order", function(){
    const ls = loadFilenames("scripts");
    let e = ls[0];
    for (let i = 1; i<ls.length; ++i) {
      assert.isTrue(e <= ls[i], `Array '${ls}' is expected to be sorted`);
      e = ls[i];
    }
  });

  it("Should execute the tasks", async function () {
    await this.env.run(TASK_DEPLOY, { noCompile: true });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
`);
  });

  it("Should persist Deployer's metadata from all tasks", async function () {
    await this.env.run(TASK_DEPLOY, { noCompile: true });
    const persistedSnapshot = loadCheckpoint("./scripts/2.js")
    assert.deepEqual(persistedSnapshot["default"].metadata, {
      "script 1 key": "script 1 value",
      "script 2 key": "script 2 value"
    });
    assert.isAtMost(persistedSnapshot["default"].timestamp, +new Date());
  });

  it("Should allow to specify scripts, preserving order", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/other-scripts/1.js", "scripts/2.js", "scripts/1.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `other scripts directory: script 1 executed
scripts directory: script 2 executed
scripts directory: script 1 executed
`);
  });

  it("Should not allow scripts outside of scripts dir", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_DEPLOY, { fileNames: ["1.js", "scripts/2.js", "scripts/1.js"] }),
      ERRORS.BUILTIN_TASKS.SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY,
      "1.js"
    );
  });

  it("Should allow to specify scripts, single script", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `scripts directory: script 1 executed\n`);
  });

  it("Should short-circuit and return failed script's status code", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_DEPLOY, { fileNames: ["scripts/other-scripts/1.js", "scripts/other-scripts/failing.js", "scripts/1.js"] }),
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      "scripts/other-scripts/failing.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, "other scripts directory: script 1 executed\n");
  });

  it("Should not execute executed scripts the second time", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/2.js", "scripts/1.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
`);
  });

  it("Should not execute executed scripts the second time", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/2.js", "scripts/1.js"], force: true });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
scripts directory: script 1 executed
`);
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
