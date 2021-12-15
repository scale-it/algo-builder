import { parsing, types } from "@algo-builder/web";
import { assert } from "chai";

import { getProgram } from "../../src";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const approvalStr = "approval-program";
describe("Algorand Smart Contracts - Update Application", function () {
  useFixture("stateful-update");
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 20 + 1000; // 1000 to cover fee
  let creator = new AccountStore(minBalance + 1000);
  const alice = new AccountStore(minBalance + 1000);

  let runtime: Runtime;
  let oldApprovalProgram: string;
  let newApprovalProgram: string;
  let clearProgram: string;
  let appID: number;
  const flags = {
    sender: creator.account,
    globalBytes: 4,
    globalInts: 4,
    localBytes: 2,
    localInts: 2
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
    appID = runtime.deployApp(flags, {}, oldApprovalProgram, clearProgram).appID;
    runtime.optInToApp(creator.address, appID, {}, {});

    // check deploy app params
    let app = runtime.getApp(appID);
    assert.isDefined(app);
    assert.deepEqual(app[approvalStr], oldApprovalProgram);
    assert.deepEqual(app["clear-state-program"], clearProgram);

    runtime.updateApp(creator.address, appID, newApprovalProgram, clearProgram, {}, {});
    app = runtime.getApp(appID);

    // check if program & state is updated after tx execution
    assert.deepEqual(app[approvalStr], newApprovalProgram);
    assert.deepEqual(runtime.getGlobalState(appID, "global-key"), parsing.stringToBytes("global-val"));
    assert.deepEqual(runtime.getLocalState(appID, creator.address, "local-key"), parsing.stringToBytes("local-val"));

    // now call the smart contract after updating approval program which checks for
    // global-key and local-key in state (which was set during the update from oldApprovalProgram)
    const noOpParams: types.AppCallsParam = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: creator.account,
      appID: appID,
      payFlags: { totalFee: 1000 }
    };
    runtime.executeTx(noOpParams);
    creator = runtime.getAccount(creator.address);

    // check state set by the 'new' approval program
    assert.deepEqual(runtime.getGlobalState(appID, "new-global-key"), parsing.stringToBytes("new-global-val"));
    assert.deepEqual(runtime.getLocalState(appID, creator.address, "new-local-key"), parsing.stringToBytes("new-local-val"));
  });

  it("should not update application if logic is rejected", function () {
    // create app
    appID = runtime.deployApp(flags, {}, oldApprovalProgram, clearProgram).appID;
    runtime.optInToApp(creator.address, appID, {}, {});

    let app = runtime.getApp(appID);
    assert.isDefined(app);
    assert.deepEqual(app[approvalStr], oldApprovalProgram);

    // update should be rejected because sender is not creator
    expectRuntimeError(
      () => runtime.updateApp(alice.address, appID, newApprovalProgram, clearProgram, {}, {}),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // verify approval program & state is not updated as tx is rejected
    app = runtime.getApp(appID);
    assert.deepEqual(app[approvalStr], oldApprovalProgram);
    assert.deepEqual(runtime.getGlobalState(appID, "global-key"), undefined);
    assert.deepEqual(runtime.getLocalState(appID, creator.address, "local-key"), undefined);
  });
});
