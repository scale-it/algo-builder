import { assert } from "chai";

import { getProgram } from "../../src";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Loops", function () {
  useFixture("loop");
  const john = new AccountStore(10e6);

  let runtime: Runtime;
  let approvalProgramPass: string;
  let approvalProgramFail: string;
  let approvalProgramFail1: string;
  let clearProgram: string;
  let flags: AppDeploymentFlags;
  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    approvalProgramPass = getProgram('approval-pass.teal');
    approvalProgramFail = getProgram('approval-fail.teal');
    approvalProgramFail1 = getProgram('approval-fail-1.teal');
    clearProgram = getProgram('clear.teal');

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
    assert.doesNotThrow(() => runtime.addApp(flags, {}, approvalProgramPass, clearProgram));
  });

  it("should fail during create application", function () {
    // this fails because in last condition we check if counter value with 10.
    expectRuntimeError(
      () => runtime.addApp(flags, {}, approvalProgramFail, clearProgram),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should fail during create application", function () {
    // this fails because we try to use loops in tealv3
    expectRuntimeError(
      () => runtime.addApp(flags, {}, approvalProgramFail1, clearProgram),
      RUNTIME_ERRORS.TEAL.LABEL_NOT_FOUND
    );
  });

  it("should skip b1 & b2 (continuous labels)", () => {
    approvalProgramPass = getProgram('continuous-labels.teal');
    // this code will pass, because at the end we check if counter is incremented 10 times
    assert.doesNotThrow(() => runtime.addApp(flags, {}, approvalProgramPass, clearProgram));
  });
});
