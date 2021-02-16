import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccount, stringToBytes } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { SignType, SSCCallsParam, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const approvalStr = "approval-program";
describe("Algorand Smart Contracts - Update Application", function () {
  useFixture("stateful-update");
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + 1000; // 1000 to cover fee
  let creator = new StoreAccount(minBalance + 1000);
  const alice = new StoreAccount(minBalance + 1000);

  let runtime: Runtime;
  let oldApprovalProgram: string;
  let newApprovalProgram: string;
  let clearProgram: string;
  let appId: number;
  const flags = {
    sender: creator.account,
    globalBytes: 32,
    globalInts: 32,
    localBytes: 8,
    localInts: 8
  };
  this.beforeAll(async function () {
    runtime = new Runtime([creator, alice]);
    oldApprovalProgram = getProgram('oldapproval.teal');
    newApprovalProgram = getProgram('newapproval.teal');
    clearProgram = getProgram('clear.teal');
  });

  it("should fail during update application if app id is not defined", function () {
    expectRuntimeError(
      () => runtime.updateApp(creator.address, 1111, oldApprovalProgram, clearProgram, {}, {}),
      RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
    );
  });

  it("should update application", function () {
    appId = runtime.addApp(flags, {}, oldApprovalProgram, clearProgram);
    runtime.optInToApp(creator.address, appId, {}, {});

    // check created app params
    let app = runtime.getApp(appId);
    assert.isDefined(app);
    assert.deepEqual(app[approvalStr], oldApprovalProgram);
    assert.deepEqual(app["clear-state-program"], clearProgram);

    runtime.updateApp(creator.address, appId, newApprovalProgram, clearProgram, {}, {});
    app = runtime.getApp(appId);

    // check if program & state is updated after tx execution
    assert.deepEqual(app[approvalStr], newApprovalProgram);
    assert.deepEqual(runtime.getGlobalState(appId, "global-key"), stringToBytes("global-val"));
    assert.deepEqual(runtime.getLocalState(appId, creator.address, "local-key"), stringToBytes("local-val"));

    // now call the smart contract after updating approval program which checks for
    // global-key and local-key in state (which was set during the update from oldApprovalProgram)
    const noOpParams: SSCCallsParam = {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: creator.account,
      appId: appId,
      payFlags: { totalFee: 1000 }
    };
    runtime.executeTx(noOpParams);
    creator = runtime.getAccount(creator.address);

    // check state set by the 'new' approval program
    assert.deepEqual(runtime.getGlobalState(appId, "new-global-key"), stringToBytes("new-global-val"));
    assert.deepEqual(runtime.getLocalState(appId, creator.address, "new-local-key"), stringToBytes("new-local-val"));
  });

  it("should not update application if logic is rejected", function () {
    // create app
    appId = runtime.addApp(flags, {}, oldApprovalProgram, clearProgram);
    runtime.optInToApp(creator.address, appId, {}, {});

    let app = runtime.getApp(appId);
    assert.isDefined(app);
    assert.deepEqual(app[approvalStr], oldApprovalProgram);

    // update should be rejected because sender is not creator
    expectRuntimeError(
      () => runtime.updateApp(alice.address, appId, newApprovalProgram, clearProgram, {}, {}),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // verify approval program & state is not updated as tx is rejected
    app = runtime.getApp(appId);
    assert.deepEqual(app[approvalStr], oldApprovalProgram);
    assert.deepEqual(runtime.getGlobalState(appId, "global-key"), undefined);
    assert.deepEqual(runtime.getLocalState(appId, creator.address, "local-key"), undefined);
  });
});
