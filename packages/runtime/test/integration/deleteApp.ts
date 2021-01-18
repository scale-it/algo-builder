import { SignType, SSCCallsParam, TransactionType } from "@algorand-builder/algob/build/types";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccount } from "../../src/index";
import { expectTealErrorAsync } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - Delete Application", function () {
  useFixture("stateful");
  const john = new StoreAccount(1000);
  const alice = new StoreAccount(1000);

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
    runtime = new Runtime([john]); // setup test
    program = getProgram('deleteApp.teal');

    deleteParams = {
      type: TransactionType.DeleteSSC,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      appId: 10,
      payFlags: {},
      appArgs: []
    };
  });

  it("should fail during delete application if app id is not defined", async function () {
    await expectTealErrorAsync(
      async () => await runtime.executeTx(deleteParams, program, []),
      ERRORS.TEAL.APP_NOT_FOUND
    );
  });

  it("should delete application", async function () {
    const appId = await runtime.addApp(flags, {}, program);
    deleteParams.appId = appId;
    await runtime.executeTx(deleteParams, program, []);

    // verify app is deleted
    const res = runtime.ctx.state.globalApps.has(appId);
    assert.equal(res, false);
  });

  it("should not delete application if logic is rejected", async function () {
    // create app
    const appId = await runtime.addApp(flags, {}, program);
    deleteParams.appId = appId;
    deleteParams.fromAccount = alice.account;

    await expectTealErrorAsync(
      async () => await runtime.executeTx(deleteParams, program, []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
    // verify app is not deleted
    const res = runtime.ctx.state.globalApps.has(appId);
    assert.equal(res, true);
  });
});
