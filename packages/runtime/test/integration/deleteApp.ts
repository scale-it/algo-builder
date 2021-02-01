import { SignType, SSCCallsParam, TransactionType } from "@algorand-builder/algob/build/types";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccount } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { expectTealError } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - Delete Application", function () {
  useFixture("stateful");
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + 1000; // 1000 to cover fee
  const john = new StoreAccount(minBalance + 1000);
  const alice = new StoreAccount(minBalance + 1000);

  let runtime: Runtime;
  let program: string;
  let deleteParams: SSCCallsParam;
  const flags = {
    sender: john.account,
    globalBytes: 32,
    globalInts: 32,
    localBytes: 8,
    localInts: 8
  };
  this.beforeAll(async function () {
    runtime = new Runtime([john, alice]); // setup test
    program = getProgram('deleteApp.teal');

    deleteParams = {
      type: TransactionType.DeleteSSC,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      appId: 10,
      payFlags: { totalFee: 1000 },
      appArgs: []
    };
  });

  it("should fail during delete application if app id is not defined", function () {
    expectTealError(
      () => runtime.executeTx(deleteParams, program, []),
      ERRORS.TEAL.APP_NOT_FOUND
    );
  });

  it("should delete application", function () {
    const appId = runtime.addApp(flags, {}, program);
    deleteParams.appId = appId;
    runtime.executeTx(deleteParams, program, []);

    // verify app is deleted
    expectTealError(
      () => runtime.getApp(appId),
      ERRORS.TEAL.APP_NOT_FOUND
    );
  });

  it("should not delete application if logic is rejected", function () {
    // create app
    const appId = runtime.addApp(flags, {}, program);
    deleteParams.appId = appId;
    deleteParams.fromAccount = alice.account;

    expectTealError(
      () => runtime.executeTx(deleteParams, program, []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // verify app is not deleted - using getApp function
    const res = runtime.getApp(appId);
    assert.isDefined(res);
  });
});
