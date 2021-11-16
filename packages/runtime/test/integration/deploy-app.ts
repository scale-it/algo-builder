import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { AppDeploymentFlags } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - Stateful Contract Account", function () {
  useFixture("stateful");
  const fee = 1000;
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + fee;
  let john = new AccountStore(minBalance + fee);

  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let appCreationFlags: AppDeploymentFlags;
  this.beforeAll(function () {
    runtime = new Runtime([john]); // setup test
    approvalProgram = getProgram('counter-approval.teal');
    clearProgram = getProgram('clear.teal');

    appCreationFlags = {
      sender: john.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };
  });

  const syncAccount = (): void => { john = runtime.getAccount(john.address); };

  it("initialize new account for deployed app(s)", function () {
    // create new app
    const appIdX = runtime.addApp(appCreationFlags, {}, approvalProgram, clearProgram).appID as number;
    const appIdY = runtime.addApp(appCreationFlags, {}, approvalProgram, clearProgram).appID as number;

    assert.isDefined(runtime.getApp(appIdX));
    assert.isDefined(runtime.getApp(appIdY));
    assert.isDefined(runtime.getAccount(getApplicationAddress(appIdX)));
    assert.isDefined(runtime.getAccount(getApplicationAddress(appIdY)));
  });

  it("initialize new account for app(s) deployed using executeTx", function () {
    // create new app
    const execParams: types.DeployAppParam = {
      ...appCreationFlags,
      type: types.TransactionType.DeployApp,
      sign: types.SignType.SecretKey,
      fromAccount: john.account,
      approvalProgram: approvalProgram,
      clearProgram: clearProgram,
      payFlags: {}
    };

    runtime.executeTx(execParams);
    syncAccount();

    const res = runtime.getAppInfoFromName(approvalProgram, clearProgram);
    assert.isDefined(res);
    assert.isDefined(res?.applicationAccount);
  });
});
