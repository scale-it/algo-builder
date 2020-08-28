import { assert } from "chai";
import fs from "fs";

import { ERRORS } from "../../../src/internal/core/errors-list";
import {
  runScript
} from "../../../src/internal/util/scripts-runner";
import { AlgobDeployerReadOnlyImpl } from "../../../src/lib/deployer";
import {
  AccountDef,
  AlgobDeployer,
  ASADeploymentFlags,
  ASAInfo,
  ASCInfo
} from "../../../src/types";
import { expectBuilderErrorAsync } from "../../helpers/errors";
import { mkAlgobEnv } from "../../helpers/params";
import { testFixtureOutputFile, useCleanFixtureProject } from "../../helpers/project";

class FakeDeployer implements AlgobDeployer {
  isDeployMode = false;
  accounts = [];
  putMetadata (key: string, value: string): void {
  };

  getMetadata (key: string): string | undefined {
    return "metadata";
  };

  async deployASA (name: string, flags: ASADeploymentFlags): Promise<ASAInfo> {
    throw new Error("Not implemented");
  };

  async deployASC (name: string, source: string, account: AccountDef): Promise<ASCInfo> {
    throw new Error("Not implemented");
  }

  isDefined (name: string): boolean {
    return false;
  };
}

describe("Scripts runner", function () {
  useCleanFixtureProject("project-with-scripts");

  it("Should pass params to the script", async function () {
    await runScript("./scripts/params-script.js", mkAlgobEnv(), new AlgobDeployerReadOnlyImpl(new FakeDeployer()));
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "network1");
  });

  it("Should run the script to completion", async function () {
    const before = new Date();
    await runScript("./scripts/async-script.js", mkAlgobEnv(), new AlgobDeployerReadOnlyImpl(new FakeDeployer()));
    const after = new Date();
    assert.isAtLeast(after.getTime() - before.getTime(), 20);
  });

  it("Exception shouldn't crash the whole app", async function () {
    await expectBuilderErrorAsync(
      async () => await runScript("./scripts/failing-script.js", mkAlgobEnv(), new AlgobDeployerReadOnlyImpl(new FakeDeployer())),
      ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
      "./scripts/failing-script.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "failing script: before exception");
  });

  it("Nonexistent default method should throw an exception", async function () {
    await expectBuilderErrorAsync(
      async () => await runScript("./scripts/no-default-method-script.js", mkAlgobEnv(), new AlgobDeployerReadOnlyImpl(new FakeDeployer())),
      ERRORS.GENERAL.NO_DEFAULT_EXPORT_IN_SCRIPT,
      "./scripts/no-default-method-script.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "script with no default method has been loaded");
  });

  it("Should wrap error of require", async function () {
    await expectBuilderErrorAsync(
      async () => await runScript("./scripts/failing-script-load.js", mkAlgobEnv(), new AlgobDeployerReadOnlyImpl(new FakeDeployer())),
      ERRORS.GENERAL.SCRIPT_LOAD_ERROR,
      "/project-with-scripts/scripts/failing-script-load.js"
    );
    const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
    assert.equal(scriptOutput, "failing load script executed\n");
  });

  it("Should ignore return value", async function () {
    const out = await runScript("./scripts/successful-script-return-status.js", mkAlgobEnv(), new AlgobDeployerReadOnlyImpl(new FakeDeployer()));
    assert.equal(out, undefined);
  });
});
