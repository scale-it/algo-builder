import { types } from "@algo-builder/web";
import { assert } from "chai";

import { getProgram } from "../../src";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE, APPLICATION_BASE_FEE } from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("Algorand Smart Contracts - Delete Application", function () {
  useFixture("stateful");
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + 1000; // 1000 to cover fee
  const john = new AccountStore(minBalance + 1000);
  const alice = new AccountStore(minBalance + 1000);

  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let deleteParams: types.AppCallsParam;
  const flags = {
    sender: john.account,
    globalBytes: 2,
    globalInts: 2,
    localBytes: 3,
    localInts: 3
  };
  this.beforeAll(async function () {
    runtime = new Runtime([john, alice]); // setup test
    approvalProgram = getProgram('deleteApp.teal');
    clearProgram = getProgram('clear.teal');

    deleteParams = {
      type: types.TransactionType.DeleteApp,
      sign: types.SignType.SecretKey,
      fromAccount: john.account,
      appID: 10,
      payFlags: { totalFee: 1000 },
      appArgs: []
    };
  });

  it("should fail during delete application if app id is not defined", function () {
    expectRuntimeError(
      () => runtime.executeTx(deleteParams),
      RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
    );
  });

  it("should delete application", function () {
    const initialMinBalance = john.minBalance;
    const appID = runtime.deployApp(approvalProgram, clearProgram, flags, {}).appID;
    assert.equal(runtime.getAccount(john.address).minBalance,
      initialMinBalance + (APPLICATION_BASE_FEE + ((25000 + 3500) * 2 + (25000 + 25000) * 2)));

    runtime.executeTx({ ...deleteParams, appID: appID });

    // verify app is deleted
    expectRuntimeError(
      () => runtime.getApp(appID),
      RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
    );
    // minbalance should reduce to initial value after app is deleted
    assert.equal(john.minBalance, initialMinBalance);
  });

  it("should not delete application if logic is rejected", function () {
    const initialMinBalance = john.minBalance;
    const appID = runtime.deployApp(approvalProgram, clearProgram, flags, {}).appID; // create app

    const minBalanceAfterDeployApp = runtime.getAccount(john.address).minBalance;
    assert.equal(minBalanceAfterDeployApp,
      initialMinBalance +
        (APPLICATION_BASE_FEE + ((25000 + 3500) * 2 + (25000 + 25000) * 2)) // min balance should increase
    );

    const deleteParams: types.AppCallsParam = {
      type: types.TransactionType.DeleteApp,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      appID: appID,
      payFlags: { totalFee: 1000 },
      appArgs: []
    };

    expectRuntimeError(
      () => runtime.executeTx(deleteParams),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // verify app is not deleted - using getApp function
    const res = runtime.getApp(appID);
    assert.isDefined(res);

    // min balance should remain the same (as after adding app), since app deletion wasn't successfull
    assert.equal(runtime.getAccount(john.address).minBalance, minBalanceAfterDeployApp);
  });
});
