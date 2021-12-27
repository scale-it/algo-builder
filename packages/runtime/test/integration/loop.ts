import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Loops", function () {
  useFixture("loop");
  const john = new AccountStore(10e6);

  let runtime: Runtime;
  let approvalProgramPassFileName: string;
  let approvalProgramFailFileName: string;
  let approvalProgramFail1FileName: string;
  let clearProgramFileName: string;
  let flags: AppDeploymentFlags;
  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    approvalProgramPassFileName = 'approval-pass.teal';
    approvalProgramFailFileName = 'approval-fail.teal';
    approvalProgramFail1FileName = 'approval-fail-1.teal';
    clearProgramFileName = 'clear.teal';

    flags = {
      sender: john.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };
  });

  it("should pass during create application", function () {
    // this code will pass, because at the end we check if counter is incremented 10 times
    assert.doesNotThrow(
      () => runtime.deployApp(approvalProgramPassFileName, clearProgramFileName, flags, {})
    );
  });

  it("should fail during create application", function () {
    // this fails because in last condition we check if counter value with 10.
    expectRuntimeError(
      () => runtime.deployApp(approvalProgramFailFileName, clearProgramFileName, flags, {}),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should fail during create application", function () {
    // this fails because we try to use loops in tealv3
    expectRuntimeError(
      () => runtime.deployApp(approvalProgramFail1FileName, clearProgramFileName, flags, {}),
      RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND
    );
  });

  it("should skip b1 & b2 (continuous labels)", () => {
    approvalProgramPassFileName = 'continuous-labels.teal';
    // this code will pass, because at the end we check if counter is incremented 10 times
    assert.doesNotThrow(
      () => runtime.deployApp(approvalProgramPassFileName, clearProgramFileName, flags, {})
    );
  });
});
