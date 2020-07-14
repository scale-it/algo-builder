import { assert } from "chai";
import * as fsExtra from "fs-extra";
import fs from "fs";

import { ERRORS } from "../../src/internal/core/errors-list";
import { useEnvironment } from "../helpers/environment";
import { expectBuilderErrorAsync } from "../helpers/errors";
import { useFixtureProject, useCleanFixtureProject, testFixtureOutputFile } from "../helpers/project";
import { TASK_RUN } from "../../src/builtin-tasks/task-names";

describe("run task", function () {
  useFixtureProject("project-with-scripts");
  useEnvironment();

  it("Should fail if a script doesn't exist", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_RUN, { scripts: ["./does-not-exist"] }),
      ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND
    );
  });

  it("Should run the scripts to completion", async function () {
    await this.env.run(TASK_RUN, {
      scripts: ["./async-script.js"]
    });

    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;
  });

  /* TODO:MM compile before running the task
  it("Should compile before running", async function () {
    if (await fsExtra.pathExists("cache")) {
      await fsExtra.remove("cache");
    }

    if (await fsExtra.pathExists("artifacts")) {
      await fsExtra.remove("artifacts");
    }

    await this.env.run(TASK_RUN, {
      scripts: ["./successful-script.js"],
    });
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;

    const files = await fsExtra.readdir("artifacts");
    assert.deepEqual(files, ["A.json"]);

    await fsExtra.remove("artifacts");
  });

  it("Shouldn't compile if asked not to", async function () {
    if (await fsExtra.pathExists("cache")) {
      await fsExtra.remove("cache");
    }

    if (await fsExtra.pathExists("artifacts")) {
      await fsExtra.remove("artifacts");
    }

    await this.env.run(TASK_RUN, {
      scripts: ["./successful-script.js"]
    });
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;

    assert.isFalse(await fsExtra.pathExists("artifacts"));
  });
  */

  it("Should return the script's status code on success", async function () {
    await this.env.run(TASK_RUN, { scripts: ["./successful-script.js"] });
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;
  });

});

describe("run task", function () {
  useCleanFixtureProject("scripts-dir");
  useEnvironment();

  it("Should allow to run multiple scripts", async function () {
    await this.env.run(TASK_RUN, { scripts: ["scripts/2.js", "scripts/1.js"] });
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `scripts directory: script 2 executed
scripts directory: script 1 executed
`);
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;
  });

  it("Should fail if any nonexistent scripts are passed", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_RUN, { scripts: ["scripts/1.js", "scripts/2.js", "scripts/3.js"] }),
      ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND
    );
  });

  it("Should short-circuit on bad exit code and display remaining scripts", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_RUN, { scripts: ["scripts/1.js", "failing.js", "scripts/2.js", "scripts/3.js"] }),
      ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND
    );
  });

  it("Should return the script's status code on failure", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_RUN, { scripts: ["other-scripts/1.js", "failing.js", "scripts/1.js"] }),
      ERRORS.BUILTIN_TASKS.EXECUTION_ERROR
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, `other scripts directory: script 1 executed
failing scripts: script failed
`);
    assert.notEqual(process.exitCode, 0);
    (process as any).exitCode = undefined;
  });

});

