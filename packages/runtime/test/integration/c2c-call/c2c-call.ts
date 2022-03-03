import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";

import { Runtime } from "../../../src/index";
import { AccountStoreI, AppDeploymentFlags } from "../../../src/types";
import { useFixture } from "../../helpers/integration";

describe("C2C call", function () {
  useFixture("c2c-call");
  let runtime: Runtime;
  let alice: AccountStoreI;
  let firstAppID: number;
  let secondAppID: number;
  this.beforeEach(() => {
    runtime = new Runtime([]);
    [alice] = runtime.defaultAccounts();
    const flags: AppDeploymentFlags = {
      sender: alice.account,
      localBytes: 10,
      globalBytes: 60,
      localInts: 10,
      globalInts: 10
    };

    firstAppID = runtime.deployApp('c2c-call.teal', 'clear.teal', flags, {}).appID;
    secondAppID = runtime.deployApp('c2c-echo.teal', 'clear.teal', flags, {}).appID;

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
  });

  it.skip("can call another application", () => {
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
    runtime.executeTx(execParams);
  });
});
