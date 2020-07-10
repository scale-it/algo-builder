import { assert } from "chai";
import * as fsExtra from "fs-extra";
import fs from "fs";
import sinon from "sinon"

import { ERRORS } from "../../src/internal/core/errors-list";
import { useEnvironmentWithBeforeEach } from "../helpers/environment";
import { expectBuilderErrorAsync } from "../helpers/errors";
import { useFixtureProject } from "../helpers/project";
import { TASK_CLEAN, TASK_MIGRATE } from "../../src/builtin-tasks/task-names";
import { AlgobRuntimeEnv } from "../../src/types";
import { getSortedScriptsNoGlob } from "../../src/builtin-tasks/migrate"

const outputFile = "output.txt"

describe("Migration task", function () {
  useFixtureProject("scripts-dir");
  useEnvironmentWithBeforeEach(async (algobEnv: AlgobRuntimeEnv) => {
    await algobEnv.run(TASK_CLEAN, {});
  });

  beforeEach(function () {
    try {
      fs.unlinkSync(outputFile)
    } catch (err) {
      // ignored
    }
  })

  it("Should execute the tasks", async function () {
    await this.env.run(TASK_MIGRATE, { noCompile: true });
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;
    const scriptOutput = fs.readFileSync(outputFile).toString()
    assert.equal(scriptOutput, `scripts directory: script 1 executed
scripts directory: script 2 executed
`);
  });

  it("Should allow to change script directory", async function () {
    await this.env.run(TASK_MIGRATE, { directory: "other-scripts", noCompile: true });
    const scriptOutput = fs.readFileSync(outputFile).toString()
    assert.equal(scriptOutput, "other scripts directory: script 1 executed");
    assert.equal(process.exitCode, 0);
    (process as any).exitCode = undefined;
  });

  it("Should complain about empty directory", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_MIGRATE, { directory: "empty-dir", noCompile: true }),
      ERRORS.BUILTIN_TASKS.SCRIPTS_NO_FILES_FOUND
    );
  });

  it("Should complain about nonexistent directory", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_MIGRATE, { directory: "nonexistent-dir", noCompile: true }),
      ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND
    );
  });

  it("Should short-circuit and return failed script's status code", async function () {
    await expectBuilderErrorAsync(
      () =>
        this.env.run(TASK_MIGRATE, { directory: "failing-dir", noCompile: true }),
      ERRORS.BUILTIN_TASKS.DEPLOY_ERROR
    );
    const scriptOutput = fs.readFileSync(outputFile).toString()
    assert.equal(scriptOutput, `failing scripts: script 1 executed
failing scripts: script 2 failed
`);
    assert.equal(process.exitCode, 123);
    (process as any).exitCode = undefined;
  });

});

describe("Migration script loading", function () {
  it("Should sort scripts", async function () {
    const globStub = sinon.stub().returns(["q", "e", "w",  "a"])
    const sortedScripts = await getSortedScriptsNoGlob("directory", globStub)
    assert.deepEqual(sortedScripts, ["a", "e", "q", "w"])
    assert.deepEqual(globStub.getCall(0).args, [ "directory", {} ])
  });
})
