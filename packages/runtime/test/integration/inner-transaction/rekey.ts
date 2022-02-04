import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore, Runtime } from "../../../src/index";
import { AccountStoreI, AppDeploymentFlags } from "../../../src/types";
import { useFixture } from "../../helpers/integration";

describe("Algorand Smart Contracts(TEALv6) - Inner Transactions[Rekey application to account] ", function () {
  useFixture("inner-transaction");
  const fee = 1000;
  const minBalance = 1e9 + fee;
  let master = new AccountStore(minBalance + fee);
  let appAccount: AccountStoreI; // initialized later

  let runtime: Runtime;
  let approvalProgramFileName: string;
  let clearProgramFileName: string;
  let appCreationFlags: AppDeploymentFlags;
  let appID: number;
  let appCallParams: types.ExecParams;
  this.beforeAll(function () {
    runtime = new Runtime([master]); // setup test
    approvalProgramFileName = 'approval-rekey.teal';
    clearProgramFileName = 'clear.teal';

    appCreationFlags = {
      sender: master.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };
  });

  this.beforeEach(() => {
    appID = runtime.deployApp(approvalProgramFileName, clearProgramFileName, appCreationFlags, {}).appID;
    appAccount = runtime.getAccount(getApplicationAddress(appID)); // update app account

    // fund app (escrow belonging to app) with 10 ALGO
    const fundAppParams: types.AlgoTransferParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: getApplicationAddress(appID),
      amountMicroAlgos: 10e6,
      payFlags: { totalFee: 1000 }
    };

    runtime.executeTx(fundAppParams);
    syncAccounts();

    appCallParams = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      appID: appID,
      payFlags: { totalFee: 1000 }
    };
  });

  function syncAccounts (): void {
    appAccount = runtime.getAccount(getApplicationAddress(appID));
    master = runtime.getAccount(master.address);
  };

  it("should rekey to another account address", function () {
    // rekey to master account
    const paymentTxParams = {
      ...appCallParams,
      accounts: [master.address]
    };
    runtime.executeTx(paymentTxParams);
    syncAccounts();
    assert.equal(appAccount.getSpendAddress(), master.address);
  });
});
