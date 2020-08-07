import { assert } from "chai";

import { ERRORS } from "../../../../src/internal/core/errors-list";
import { ALGOB_PARAM_DEFINITIONS } from "../../../../src/internal/core/params/builder-params";
import {
  getEnvRuntimeArgs,
  getEnvVariablesMap,
  paramNameToEnvVariable
} from "../../../../src/internal/core/params/env-variables";
import { expectBuilderError } from "../../../helpers/errors";

// This is testing an internal function, which may seem weird, but its behaviour
// is 100% user facing.
describe("paramNameToEnvVariable", () => {
  it("should convert camelCase to UPPER_CASE and prepend BUILDER_", () => {
    assert.equal(paramNameToEnvVariable("a"), "BUILDER_A");
    assert.equal(paramNameToEnvVariable("B"), "BUILDER_B");
    assert.equal(paramNameToEnvVariable("AC"), "BUILDER_A_C");
    assert.equal(paramNameToEnvVariable("aC"), "BUILDER_A_C");
    assert.equal(
      paramNameToEnvVariable("camelCaseRight"),
      "BUILDER_CAMEL_CASE_RIGHT"
    );
    assert.equal(
      paramNameToEnvVariable("somethingAB"),
      "BUILDER_SOMETHING_A_B"
    );
  });
});

describe("Env vars arguments parsing", () => {
  it("Should use the default values if arguments are not defined", () => {
    const args = getEnvRuntimeArgs(ALGOB_PARAM_DEFINITIONS, {
      IRRELEVANT_ENV_VAR: "123"
    });
    assert.equal(args.help, ALGOB_PARAM_DEFINITIONS.help.defaultValue);
    assert.equal(args.network, ALGOB_PARAM_DEFINITIONS.network.defaultValue);
    assert.equal(
      args.showStackTraces,
      ALGOB_PARAM_DEFINITIONS.showStackTraces.defaultValue
    );
    assert.equal(args.version, ALGOB_PARAM_DEFINITIONS.version.defaultValue);
  });

  it("Should accept values", () => {
    const args = getEnvRuntimeArgs(ALGOB_PARAM_DEFINITIONS, {
      IRRELEVANT_ENV_VAR: "123",
      BUILDER_NETWORK: "asd",
      BUILDER_SHOW_STACK_TRACES: "true",
      BUILDER_VERSION: "true",
      BUILDER_HELP: "true"
    });

    assert.equal(args.network, "asd");

    // These are not really useful, but we test them anyway
    assert.equal(args.showStackTraces, true);
    assert.equal(args.version, true);
    assert.equal(args.help, true);
  });

  it("should throw if an invalid value is passed", () => {
    expectBuilderError(
      () =>
        getEnvRuntimeArgs(ALGOB_PARAM_DEFINITIONS, {
          BUILDER_HELP: "123"
        }),
      ERRORS.ARGUMENTS.INVALID_ENV_VAR_VALUE
    );
  });
});

describe("getEnvVariablesMap", () => {
  it("Should return the right map", () => {
    assert.deepEqual(
      getEnvVariablesMap({
        network: "asd",
        help: true,
        showStackTraces: true,
        version: false,
        verbose: true,
        config: undefined // config is optional
      }),
      {
        BUILDER_NETWORK: "asd",
        BUILDER_HELP: "true",
        BUILDER_SHOW_STACK_TRACES: "true",
        BUILDER_VERSION: "false",
        BUILDER_VERBOSE: "true"
      }
    );
  });
});
