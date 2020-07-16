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
      () => this.env.run(TASK_RUN, { scripts: ["./does-not-exist"] }),
      ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND,
      "./does-not-exist"
    );
  });

  it("Should run the scripts to completion", async function () {
    await this.env.run(TASK_RUN, {
      scripts: ["./async-script.js"]
    });
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

    assert.isFalse(await fsExtra.pathExists("artifacts"));
  });
  */

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
  });

  it("Should fail if any nonexistent scripts are passed", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_RUN, { scripts: ["scripts/1.js", "scripts/2.js", "scripts/3.js"] }),
      ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND,
      "scripts/3.js"
    );
  });

  it("Should return the script's status code on failure", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_RUN, { scripts: ["other-scripts/1.js", "failing.js", "scripts/1.js"] }),
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      "failing.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, "other scripts directory: script 1 executed\n");
  });

});
