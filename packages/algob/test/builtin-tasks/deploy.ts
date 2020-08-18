import { assert } from "chai";
import * as fs from "fs";

import { loadFilenames } from "../../src/builtin-tasks/deploy";
import { TASK_DEPLOY, TASK_RUN } from "../../src/builtin-tasks/task-names";
import { ERRORS } from "../../src/internal/core/errors-list";
import { loadCheckpoint } from "../../src/lib/script-checkpoints";
import { expectBuilderErrorAsync } from "../helpers/errors";
import { testFixtureOutputFile, useCleanFixtureProject } from "../helpers/project";

describe("Deploy task", function () {
  useCleanFixtureProject("scripts-dir");

  it("Should load scripts in the right order", function () {
    const ls = loadFilenames("scripts");
    let e = ls[0];
    for (let i = 1; i < ls.length; ++i) {
      assert.isTrue(e <= ls[i], `Array '${ls.toString()}' is expected to be sorted`);
      e = ls[i];
    }
  });

  it("Should execute the deploy task", async function () {
    await this.env.run(TASK_DEPLOY, { noCompile: true });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
`);
  });

  it("Should persist Deployer's metadata from all tasks in separate checkpoints", async function () {
    await this.env.run(TASK_DEPLOY, { noCompile: true });
    const snapshot1 = loadCheckpoint("./scripts/1.js");
    assert.deepEqual(snapshot1.default.metadata, {
      "script 1 key": "script 1 value"
    });
    assert.isAtMost(snapshot1.default.timestamp, +new Date());
    const snapshot2 = loadCheckpoint("./scripts/2.js");
    assert.deepEqual(snapshot2.default.metadata, {
      "script 2 key": "script 2 value"
    });
    assert.isAtMost(snapshot2.default.timestamp, +new Date());
    assert.isAtMost(snapshot1.default.timestamp, snapshot2.default.timestamp);
  });

  it("Should not allow scripts outside of scripts dir", async function () {
    await expectBuilderErrorAsync(
      async () =>
        await this.env.run(TASK_DEPLOY, { fileNames: ["1.js", "scripts/2.js", "scripts/1.js"] }),
      ERRORS.BUILTIN_TASKS.DEPLOY_SCRIPT_NON_DIRECT_CHILD,
      "1.js"
    );
  });

  it("Should allow to specify scripts, single script", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, `scripts directory: script 1 executed\n`);
  });

  it("Should not execute executed scripts the second time", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/2.js", "scripts/1.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
`);
  });

  it("Should execute executed scripts the second time with --force", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/2.js", "scripts/1.js"], force: true });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
scripts directory: script 1 executed
`);
  });
});

describe("Deploy task: nested state files", function () {
  useCleanFixtureProject("scripts-dir-recursive-cp");

  it("Deployer should accumulate state during the run 1", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js", "scripts/query.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, `ASA from first defined: true
ASC from second defined: false`);
  });

  it("Deployer should fail during nested execution", async function () {
    await expectBuilderErrorAsync(
      async () => await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js", "scripts/nested/nested.js"] }),
      ERRORS.BUILTIN_TASKS.DEPLOY_SCRIPT_NON_DIRECT_CHILD,
      "scripts/nested/nested.js");
    assert.isFalse(fs.existsSync(testFixtureOutputFile));
  });

  it("Deployer should accumulate state during the run 2", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js", "scripts/2.js", "scripts/query.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, `ASA from first defined: true
ASC from second defined: true`);
  });

  it("Deployer should load deployed assets before running scripts; should not show them", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/query.js"] });
    const scriptOutputBefore = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputBefore, `ASA from first defined: false
ASC from second defined: false`);
    fs.unlinkSync(testFixtureOutputFile);
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js", "scripts/2.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/query.js"] });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `ASA from first defined: true
ASC from second defined: true`);
  });

  it("Deployer --force should allow to rewrite existing assets; one script", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    await this.env.run(TASK_DEPLOY, {
      fileNames: ["scripts/1.js", "scripts/query.js"],
      force: true
    });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `ASA from first defined: true
ASC from second defined: false`);
  });

  it("Deployer --force should allow to rewrite existing assets; two scripts", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js", "scripts/2.js"] });
    await this.env.run(TASK_DEPLOY, {
      fileNames: ["scripts/1.js", "scripts/2.js", "scripts/query.js"],
      force: true
    });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `ASA from first defined: true
ASC from second defined: true`);
  });
});

describe("Deploy task: inter-script checkpoint state", function () {
  useCleanFixtureProject("scripts-dir-cp-state");

  it("should load previous state", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/2.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/3.js"] });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `script1: META from first defined: first-ok
script1: META from second defined: undefined
script1: META from third defined: undefined
script2: META from first defined: first-ok
script2: META from second defined: second-ok
script2: META from third defined: undefined
script3: META from first defined: first-ok
script3: META from second defined: second-ok
script3: META from third defined: third-ok
`);
  });

  it("should load previous state; multiple intermediate scripts", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js", "scripts/2.js"] });
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/3.js"] });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `script1: META from first defined: first-ok
script1: META from second defined: undefined
script1: META from third defined: undefined
script2: META from first defined: first-ok
script2: META from second defined: second-ok
script2: META from third defined: undefined
script3: META from first defined: first-ok
script3: META from second defined: second-ok
script3: META from third defined: third-ok
`);
  });

  it("should load previous state when run has read-only set to true", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js"] });
    fs.unlinkSync(testFixtureOutputFile);
    await this.env.run(TASK_RUN, { scripts: ["scripts/2.js"] });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `script2: META from first defined: first-ok
script2: META from second defined: undefined
script2: META from third defined: undefined\n`);
  });

  it("should load previous state when run has read-only set to true", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/1.js", "scripts/2.js"] });
    fs.unlinkSync(testFixtureOutputFile);
    await this.env.run(TASK_RUN, { scripts: ["scripts/2.js"] });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `script2: META from first defined: first-ok
script2: META from second defined: second-ok
script2: META from third defined: undefined\n`);
  });

  it("should not sort script names before execution", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/2.js", "scripts/3.js", "scripts/1.js"] });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `script2: META from first defined: undefined
script2: META from second defined: second-ok
script2: META from third defined: undefined
script3: META from first defined: undefined
script3: META from second defined: second-ok
script3: META from third defined: third-ok
script1: META from first defined: first-ok
script1: META from second defined: undefined
script1: META from third defined: undefined
`);
  });

  it("should normalize paths", async function () {
    await this.env.run(TASK_DEPLOY, { fileNames: ["scripts/../scripts/1.js", "./scripts/2.js", "./scripts/../scripts/3.js"] });
    const scriptOutputAfter = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutputAfter, `script1: META from first defined: first-ok
script1: META from second defined: undefined
script1: META from third defined: undefined
script2: META from first defined: first-ok
script2: META from second defined: second-ok
script2: META from third defined: undefined
script3: META from first defined: first-ok
script3: META from second defined: second-ok
script3: META from third defined: third-ok
`);
  });
});

describe("Deploy task: empty scripts dir", function () {
  useCleanFixtureProject("scripts-dir-empty");

  it("Should complain about no scripts", async function () {
    await expectBuilderErrorAsync(
      async () =>
        await this.env.run(TASK_DEPLOY, {}),
      ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND
    );
  });
});

describe("Deploy task: no scripts dir", function () {
  useCleanFixtureProject("scripts-dir-none");

  it("Should complain about nonexistent directory", async function () {
    await expectBuilderErrorAsync(
      async () =>
        await this.env.run(TASK_DEPLOY, { directory: "nonexistent-dir" }),
      ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND
    );
  });
});
