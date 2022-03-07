import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { Runtime } from "../../../src/index";
import { AccountStoreI, AppDeploymentFlags, TxReceipt } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

describe("C2C call", function () {
  useFixture("c2c-call");
  let runtime: Runtime;
  let alice: AccountStoreI;
  let firstAppID: number;
  let secondAppID: number;
  let thirdAppID: number;

  this.beforeEach(() => {
    runtime = new Runtime([]);
    [alice] = runtime.defaultAccounts();
    const flags: AppDeploymentFlags = {
      sender: alice.account,
      localBytes: 1,
      globalBytes: 1,
      localInts: 1,
      globalInts: 1
    };

    firstAppID = runtime.deployApp('c2c-call.teal', 'clear.teal', flags, {}).appID;
    secondAppID = runtime.deployApp('c2c-echo.teal', 'clear.teal', flags, {}).appID;
    thirdAppID = runtime.deployApp('dummy-approval-v5.teal', 'dummy-clear-v5.teal', flags, {}).appID;

    const fundTx: types.AlgoTransferParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      toAccountAddr: getApplicationAddress(firstAppID),
      amountMicroAlgos: 1e6,
      payFlags: {
        totalFee: 1000
      }
    };

    runtime.executeTx(fundTx);

    fundTx.toAccountAddr = getApplicationAddress(secondAppID);
    runtime.executeTx(fundTx);

    fundTx.toAccountAddr = getApplicationAddress(thirdAppID);
    runtime.executeTx(fundTx);
  });

  it("can call another application", () => {
    const execParams: types.ExecParams = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      foreignApps: [secondAppID],
      appID: firstAppID,
      appArgs: ['str:call_method', 'int:1'],
      payFlags: {
        totalFee: 2000
      }
    };
    const txReceipt = runtime.executeTx(execParams) as TxReceipt;
    const logs = txReceipt.logs ?? [];
    assert.deepEqual(logs[0].substring(6), "Call from applicatiton");
  });

  it("should failed: inner call to app have teal version 5", () => {
    const execParams: types.ExecParams = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      foreignApps: [thirdAppID],
      appID: firstAppID,
      appArgs: ['str:call_method', 'int:1'],
      payFlags: {
        totalFee: 2000
      }
    };

    expectRuntimeError(
      () => runtime.executeTx(execParams),
      RUNTIME_ERRORS.GENERAL.INNER_APP_CALL_INVALID_VERSION
    );
  });
});
