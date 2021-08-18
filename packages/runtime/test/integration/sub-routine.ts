import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Sub routine", function () {
  useFixture("sub-routine");
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
    // this code will pass, because sub-routine is working
    assert.doesNotThrow(() => runtime.addApp(flags, {}, approvalProgramPass, clearProgram));
  });

  it("should fail during create application", function () {
    // this fails because in last condition we check if over subroutine section was executed
    expectRuntimeError(
      () => runtime.addApp(flags, {}, approvalProgramFail, clearProgram),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should fail during create application", function () {
    // this fails because there is no callsub before retsub(therefore callstack is empty)
    expectRuntimeError(
      () => runtime.addApp(flags, {}, approvalProgramFail1, clearProgram),
      RUNTIME_ERRORS.TEAL.CALL_STACK_EMPTY
    );
  });
});
