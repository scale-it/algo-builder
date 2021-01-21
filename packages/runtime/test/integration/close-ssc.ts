import { SignType, SSCCallsParam, TransactionType } from "@algorand-builder/algob/build/types";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccount } from "../../src/index";
import { stringToBytes } from "../../src/lib/parsing";
import { expectTealErrorAsync } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - CloseOut from Application", function () {
  useFixture("stateful");
  let john = new StoreAccount(1000);
  const alice = new StoreAccount(1000);

  let runtime: Runtime;
  let program: string;
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
    program = getProgram('close-ssc.teal');

    closeOutParams = {
      type: TransactionType.CloseSSC,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      appId: 11,
      payFlags: {}
    };
  });

  const syncAccount = (): void => { john = runtime.getAccount(john.address); };

  it("should fail during closeOut if app id is not defined", async function () {
    await expectTealErrorAsync(
      async () => await runtime.executeTx(closeOutParams, program, []),
      ERRORS.TEAL.APP_NOT_FOUND
    );
  });

  it("should successfully closeOut from app and update state according to asc", async function () {
    const appId = await runtime.addApp(flags, {}, program); // create app
    closeOutParams.appId = appId;
    await runtime.optInToApp(john.address, appId, {}, {}, program); // opt-in to app (set new local state)

    // execute clostOut txn
    await runtime.executeTx(closeOutParams, program, []);

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

  it("should not delete application if logic is rejected", async function () {
    // create app
    const appId = await runtime.addApp(flags, {}, program);
    closeOutParams.appId = appId;
    await runtime.optInToApp(john.address, appId, {}, {}, program); // opt-in to app (set new local state)

    // sending txn sender other than creator (john), so txn should be rejected
    closeOutParams.fromAccount = alice.account;

    await expectTealErrorAsync(
      async () => await runtime.executeTx(closeOutParams, program, []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // verify app is not deleted from account's local state (as tx is rejected)
    const res = john.getAppFromLocal(appId);
    assert.isDefined(res);
  });
});
