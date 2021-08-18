import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Dynamic Opcode Cost calculation", function () {
  useFixture("dynamic-op-cost");
  const john = new AccountStore(10e6);

  let runtime: Runtime;
  let approvalProgramPass: string;
  let approvalProgramFail: string;
  let clearProgram: string;
  let flags: AppDeploymentFlags;
  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    approvalProgramPass = getProgram('approval-pass.teal');
    approvalProgramFail = getProgram('approval-fail.teal');
    clearProgram = getProgram('clear.teal');

    flags = {
      sender: john.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };
  });

  it("should fail during create application if pragma version <= 3", function () {
    expectRuntimeError(
      () => runtime.addApp(flags, {}, approvalProgramFail, clearProgram),
      RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
    );
  });

  it("should pass during create application if pragma version >= 4", function () {
    // same program with teal version == 4. Since cost is calculation during execution,
    // this code will pass.
    assert.doesNotThrow(() => runtime.addApp(flags, {}, approvalProgramPass, clearProgram));
  });
});
