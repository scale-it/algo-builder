import { assert } from "chai";

import {
  resolveBuilderRegisterPath,
  runScript,
  runScriptWithAlgob,
} from "../../../src/internal/util/scripts-runner";
import { useEnvironment } from "../../helpers/environment";
import { useFixtureProject } from "../../helpers/project";

describe("Scripts runner", function () {
  useFixtureProject("project-with-scripts");

  it("Should pass params to the script", async function () {
    const [
      statusCodeWithScriptParams,
      statusCodeWithNoParams,
    ] = await Promise.all([
      runScript("./params-script.js", ["a", "b", "c"]),
      runScript("./params-script.js"),
    ]);

    assert.equal(statusCodeWithScriptParams, 0);

    // We check here that the script is correctly testing this:
    assert.notEqual(statusCodeWithNoParams, 0);
  });

  it("Should run the script to completion", async function () {
    const before = new Date();
    await runScript("./async-script.js");
    const after = new Date();

    assert.isAtLeast(after.getTime() - before.getTime(), 100);
  });

  it("Should resolve to the status code of the script run", async function () {
    const builderRegisterPath = resolveBuilderRegisterPath();

    const extraNodeArgs = ["--require", builderRegisterPath];
    const scriptArgs: string[] = [];

    const runScriptCases = [
      {
        scriptPath: "./async-script.js",
        extraNodeArgs,
        expectedStatusCode: 0,
      },
      {
        scriptPath: "./failing-script.js",
        expectedStatusCode: 123,
      },
      {
        scriptPath: "./successful-script.js",
        extraNodeArgs,
        expectedStatusCode: 0,
      },
    ];

    const runScriptTestResults = await Promise.all(
      runScriptCases.map(
        async ({ scriptPath, extraNodeArgs: _extraNodeArgs }) => {
          const statusCode =
            _extraNodeArgs === undefined
              ? await runScript(scriptPath)
              : await runScript(scriptPath, scriptArgs, _extraNodeArgs);
          return { scriptPath, statusCode };
        }
      )
    );

    const expectedResults = runScriptCases.map(
      ({ expectedStatusCode, scriptPath }) => ({
        scriptPath,
        statusCode: expectedStatusCode,
      })
    );

    assert.deepEqual(runScriptTestResults, expectedResults);
  });

  it("Should pass env variables to the script", async function () {
    const [statusCodeWithEnvVars, statusCodeWithNoEnvArgs] = await Promise.all([
      runScript("./env-var-script.js", [], [], {
        TEST_ENV_VAR: "test",
      }),
      runScript("./env-var-script.js"),
    ]);

    assert.equal(
      statusCodeWithEnvVars,
      0,
      "Status code with env vars should be 0"
    );

    assert.notEqual(
      statusCodeWithNoEnvArgs,
      0,
      "Status code with no env vars should not be 0"
    );
  });

  describe("runWithBuilder", function () {
    useEnvironment();

    it("Should load builder/register successfully", async function () {
      const [
        statusCodeWithBuilder,
        statusCodeWithoutBuilder,
      ] = await Promise.all([
        runScriptWithAlgob(
          this.env.runtimeArgs,
          "./successful-script.js"
        ),
        runScript("./successful-script.js"),
      ]);

      assert.equal(statusCodeWithBuilder, 0);

      // We check here that the script is correctly testing this:
      assert.notEqual(statusCodeWithoutBuilder, 0);
    });

    it("Should forward all the builder arguments", async function () {
      // This is only for testing purposes, as we can't set a builder argument
      // as the CLA does, and env variables always get forwarded to child
      // processes
      this.env.runtimeArgs.network = "custom";

      const statusCode = await runScriptWithAlgob(
        this.env.runtimeArgs,
        "./assert-builder-arguments.js"
      );

      assert.equal(statusCode, 0);
    });
  });
});
