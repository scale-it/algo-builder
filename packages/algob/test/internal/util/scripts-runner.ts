import { assert } from "chai";
import fs from "fs";

import { ERRORS } from "../../../src/internal/core/errors-list";
import { DeployerRunMode } from "../../../src/internal/deployer";
import { TxWriterImpl } from "../../../src/internal/tx-log-writer";
import {
  runScript
} from "../../../src/internal/util/scripts-runner";
import { CheckpointRepoImpl } from "../../../src/lib/script-checkpoints";
import { expectBuilderErrorAsync } from "../../helpers/errors";
import { mkAlgobEnv } from "../../helpers/params";
import { testFixtureOutputFile, useCleanFixtureProject } from "../../helpers/project";
import { AlgoOperatorDryRunImpl } from "../../stubs/algo-operator";

describe("Scripts runner", function () {
  useCleanFixtureProject("project-with-scripts");

  it("Should pass params to the script", async function () {
    const env = mkAlgobEnv();
    await runScript("./scripts/params-script.js", env, new DeployerRunMode(
      env, new CheckpointRepoImpl(), {}, new AlgoOperatorDryRunImpl(), new Map(), new TxWriterImpl('')));
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "network1");
  });

  it("Should run the script to completion", async function () {
    const before = new Date();
    const env = mkAlgobEnv();
    await runScript("./scripts/async-script.js", env, new DeployerRunMode(
      env, new CheckpointRepoImpl(), {}, new AlgoOperatorDryRunImpl(), new Map(), new TxWriterImpl('')));
    const after = new Date();
    assert.isAtLeast(after.getTime() - before.getTime(), 20);
  });

  it("Exception shouldn't crash the whole app", async function () {
    const env = mkAlgobEnv();
    await expectBuilderErrorAsync(
      async () => await runScript("./scripts/failing-script.js", env, new DeployerRunMode(
        env, new CheckpointRepoImpl(), {}, new AlgoOperatorDryRunImpl(), new Map(), new TxWriterImpl(''))),
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      "./scripts/failing-script.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "failing script: before exception");
  });

  it("Nonexistent default method should throw an exception", async function () {
    const env = mkAlgobEnv();
    await expectBuilderErrorAsync(
      async () => await runScript("./scripts/no-default-method-script.js", env, new DeployerRunMode(
        env, new CheckpointRepoImpl(), {}, new AlgoOperatorDryRunImpl(), new Map(), new TxWriterImpl(''))),
      ERRORS.GENERAL.NO_DEFAULT_EXPORT_IN_SCRIPT,
      "./scripts/no-default-method-script.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "script with no default method has been loaded");
  });

  it("Should wrap error of require", async function () {
    const env = mkAlgobEnv();
    await expectBuilderErrorAsync(
      async () => await runScript("./scripts/failing-script-load.js", env, new DeployerRunMode(
        env, new CheckpointRepoImpl(), {}, new AlgoOperatorDryRunImpl(), new Map(), new TxWriterImpl(''))),
      ERRORS.GENERAL.SCRIPT_LOAD_ERROR,
      "/project-with-scripts/scripts/failing-script-load.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "failing load script executed\n");
  });

  it("Should ignore return value", async function () {
    const env = mkAlgobEnv();
    const out = await runScript("./scripts/successful-script-return-status.js", env, new DeployerRunMode(
      env, new CheckpointRepoImpl(), {}, new AlgoOperatorDryRunImpl(), new Map(), new TxWriterImpl('')));
    assert.equal(out, undefined);
  });
});
