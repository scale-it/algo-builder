import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Sub routine", function () {
  useFixture("sub-routine");
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
      localInts: 1,
      appArgs: ['int:5']
    };
  });

  it("should pass during create application", function () {
    // this code will pass, because sub-routine is working
    assert.doesNotThrow(
      () => runtime.deployApp(approvalProgramPassFileName, clearProgramFileName, flags, {})
    );
  });

  it("should fail during create application", function () {
    // this fails because in last condition we check if over subroutine section was executed
    expectRuntimeError(
      () => runtime.deployApp(approvalProgramFailFileName, clearProgramFileName, flags, {}),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should fail during create application", function () {
    // this fails because there is no callsub before retsub(therefore callstack is empty)
    expectRuntimeError(
      () => runtime.deployApp(approvalProgramFail1FileName, clearProgramFileName, flags, {}),
      RUNTIME_ERRORS.TEAL.CALL_STACK_EMPTY
    );
  });

  it("should calculate correct fibonacci number", () => {
    const fibProgFileName = 'fibonacci.teal';
    let appID = runtime.deployApp(fibProgFileName, clearProgramFileName, flags, {}).appID;

    // 5th fibonacci
    let result = runtime.getGlobalState(appID, 'result');
    assert.equal(result, 5n);

    // 6th fibonacci
    flags.appArgs = ['int:6'];
    appID = runtime.deployApp(fibProgFileName, clearProgramFileName, flags, {}).appID;
    result = runtime.getGlobalState(appID, 'result');

    assert.equal(result, 8n);

    // 8th fibonacci
    flags.appArgs = ['int:8'];
    appID = runtime.deployApp(fibProgFileName, clearProgramFileName, flags, {}).appID;
    result = runtime.getGlobalState(appID, 'result');

    assert.equal(result, 21n);

    // 1st fibonacci
    flags.appArgs = ['int:1'];
    appID = runtime.deployApp(fibProgFileName, clearProgramFileName, flags, {}).appID;
    result = runtime.getGlobalState(appID, 'result');

    assert.equal(result, 1n);
  });

  it("should throw cost exceed error", () => {
    flags.appArgs = ['int:9'];
    const fibProgFileName = 'fibonacci.teal';
    expectRuntimeError(
      () => runtime.deployApp(fibProgFileName, clearProgramFileName, flags, {}),
      RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
    );
  });
});
