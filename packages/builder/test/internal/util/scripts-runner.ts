import { assert } from "chai";
import fs from "fs";

import {
  resolveBuilderRegisterPath,
  runScript
} from "../../../src/internal/util/scripts-runner";
import { useEnvironment } from "../../helpers/environment";
import { useFixtureProject, useCleanFixtureProject, testFixtureOutputFile } from "../../helpers/project";
import { AlgobRuntimeEnv, PromiseAny, Network } from "../../../src/types";
import { expectBuilderErrorAsync } from "../../helpers/errors";
import { mkAlgobEnv } from "../../helpers/params";
import { ERRORS } from "../../../src/internal/core/errors-list"

describe("Scripts runner", function () {
  useCleanFixtureProject("project-with-scripts");

  it("Should pass params to the script", async function () {
    await runScript("./params-script.js", mkAlgobEnv())
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, "network name");
  });

  it("Should run the script to completion", async function () {
    const before = new Date();
    await runScript("./async-script.js", mkAlgobEnv());
    const after = new Date();
    assert.isAtLeast(after.getTime() - before.getTime(), 100);
  });

  it("Exception shouldn't crash the whole app", async function () {
    await expectBuilderErrorAsync(
      () => runScript("./failing-script.js", mkAlgobEnv()),
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      "./failing-script.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, "failing script: before exception");
  });

  it("Nonexistent default method should throw an exception", async function () {
    await expectBuilderErrorAsync(
      () => runScript("./no-default-method-script.js", mkAlgobEnv()),
      ERRORS.GENERAL.NO_DEFAULT_EXPORT_IN_SCRIPT,
      "./no-default-method-script.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, "script with no default method has been loaded");
  });

  it("Should wrap error of require", async function () {
    await expectBuilderErrorAsync(
      () => runScript("./failing-script-load.js", mkAlgobEnv()),
      ERRORS.GENERAL.SCRIPT_LOAD_ERROR,
      "/project-with-scripts/failing-script-load.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString()
    assert.equal(scriptOutput, "failing load script executed\n");
  });

  it("Should ignore return value", async function () {
    const out = await runScript("./successful-script-return-status.js", mkAlgobEnv())
    assert.equal(out, undefined);
  });

});
