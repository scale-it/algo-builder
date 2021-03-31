import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { stringToBytes } from "../../src/lib/parsing";
import { SignType, SSCCallsParam, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("ASC - CloseOut from Application and Clear State", function () {
  useFixture("stateful");
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + 1000; // 1000 to cover fee
  let john = new AccountStore(minBalance + 1000);
  let alice = new AccountStore(minBalance + 1000);

  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let closeOutParams: SSCCallsParam;
  const flags = {
    sender: john.account,
    globalBytes: 32,
    globalInts: 32,
    localBytes: 8,
    localInts: 8
  };
  this.beforeAll(async function () {
    runtime = new Runtime([john, alice]); // setup test
    approvalProgram = getProgram('close-clear-ssc.teal');
    clearProgram = getProgram('clear.teal');

    closeOutParams = {
      type: TransactionType.CloseSSC,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      appId: 11,
      payFlags: { totalFee: 1000 }
    };
  });

  const syncAccount = (): void => {
    john = runtime.getAccount(john.address);
    alice = runtime.getAccount(alice.address);
  };

  it("should fail during closeOut if app id is not defined", function () {
    expectRuntimeError(
      () => runtime.executeTx(closeOutParams),
      RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
    );
  });

  it("should successfully closeOut from app and update state according to asc", function () {
    const appId = runtime.addApp(flags, {}, approvalProgram, clearProgram); // create app
    closeOutParams.appId = appId;
    runtime.optInToApp(john.address, appId, {}, {}); // opt-in to app (set new local state)

    runtime.executeTx(closeOutParams);

    syncAccount();
    // verify app is deleted from local state
    const localApp = john.getAppFromLocal(appId);
    assert.isUndefined(localApp);

    // verify app is NOT deleted from global state
    const globalApp = runtime.getApp(appId);
    assert.isDefined(globalApp);

    // since app is deleted from local, local state should be undefined
    const localVal = runtime.getLocalState(appId, john.address, 'local-key');
    assert.isUndefined(localVal);

    // since app is not deleted from global, global state should be updated by smart contract
    const globalVal = runtime.getGlobalState(appId, 'global-key');
    assert.deepEqual(globalVal, stringToBytes('global-val'));
  });

  it("should throw error if user is not opted-in for closeOut call", function () {
    // create app
    const appId = runtime.addApp(flags, {}, approvalProgram, clearProgram);
    closeOutParams.appId = appId;

    expectRuntimeError(
      () => runtime.executeTx(closeOutParams),
      RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
    );
    syncAccount();
  });

  it("should not delete application on CloseOut call if logic is rejected", function () {
    // create app
    const appId = runtime.addApp(flags, {}, approvalProgram, clearProgram);
    closeOutParams.appId = appId;
    runtime.optInToApp(john.address, appId, {}, {}); // opt-in to app (set new local state)
    syncAccount();

    // sending txn sender other than creator (john), so txn should be rejected
    closeOutParams.fromAccount = alice.account;

    expectRuntimeError(
      () => runtime.executeTx(closeOutParams),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // verify app is not deleted from account's local state (as tx is rejected)
    const res = john.getAppFromLocal(appId);
    assert.isDefined(res);
  });

  // clearState call is different from closeOut call as in clear call, app is deleted from account
  // even if transaction fails
  it("should delete application on clearState call even if logic is rejected", function () {
    // create app
    const rejectClearProgram = getProgram('rejectClear.teal');
    const appId = runtime.addApp(flags, {}, approvalProgram, rejectClearProgram);
    const clearAppParams: SSCCallsParam = {
      type: TransactionType.ClearSSC,
      sign: SignType.SecretKey,
      fromAccount: alice.account, // sending txn sender other than creator (john), so txn should be rejected
      appId: appId,
      payFlags: {}
    };
    runtime.optInToApp(alice.address, appId, {}, {}); // opt-in to app (set new local state)
    syncAccount();

    // verify before tx execution that local state is present
    let res = alice.getAppFromLocal(appId);
    assert.isDefined(res);

    runtime.executeTx(clearAppParams);

    syncAccount();
    // verify app is deleted from account's local state even if tx is rejected after execution
    res = alice.getAppFromLocal(appId);
    assert.isUndefined(res);

    // verify global state is not deleted
    assert.isDefined(runtime.getApp(appId));
  });
});
