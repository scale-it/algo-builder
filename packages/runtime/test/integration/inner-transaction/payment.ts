import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { getProgram } from "../../../src";
import { AccountStore, Runtime } from "../../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../../src/lib/constants";
import { AccountStoreI, AppDeploymentFlags } from "../../../src/types";
import { useFixture } from "../../helpers/integration";

describe("Algorand Smart Contracts(TEALv5) - Inner Transactions[ALGO Payment]", function () {
  useFixture("inner-transaction");
  const fee = 1000;
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + fee;
  const master = new AccountStore(300e6);
  let john = new AccountStore(minBalance + fee);
  let elon = new AccountStore(minBalance + fee);
  let bob = new AccountStore(minBalance + fee);
  let appAccount: AccountStoreI; // initialized later

  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let appCreationFlags: AppDeploymentFlags;
  let appID: number;
  let appCallParams: types.ExecParams;
  this.beforeAll(function () {
    runtime = new Runtime([master, john, elon, bob]); // setup test
    approvalProgram = getProgram('approval-payment.py');
    clearProgram = getProgram('clear.teal');

    appCreationFlags = {
      sender: john.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };
  });

  this.beforeEach(() => {
    appID = runtime.addApp(appCreationFlags, {}, approvalProgram, clearProgram);
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
      fromAccount: john.account,
      appID: appID,
      payFlags: { totalFee: 1000 }
    };
  });

  function syncAccounts (): void {
    appAccount = runtime.getAccount(getApplicationAddress(appID));
    john = runtime.getAccount(john.address);
    elon = runtime.getAccount(elon.address);
    bob = runtime.getAccount(bob.address);
  };

  it("initiate payment from smart contract", function () {
    const appAccountBalBefore = appAccount.balance();
    const johnBalBefore = john.balance();
    const elonBalBefore = elon.balance();

    // contracts pays 1ALGO to sender, and 2Algo's to txn.accounts[1]
    const paymentTxParams = {
      ...appCallParams,
      appArgs: ['str:pay'],
      accounts: [elon.address]
    };
    runtime.executeTx(paymentTxParams);
    syncAccounts();

    assert.equal(john.balance(), johnBalBefore + BigInt(1e6) - 1000n);
    assert.equal(elon.balance(), elonBalBefore + BigInt(2e6));
    assert.equal(appAccount.balance(), appAccountBalBefore - BigInt(3e6) - 2000n);
  });

  it("should not deduct fee from contract if enough fee available in pool", function () {
    const appAccountBalBefore = appAccount.balance();

    // same as prev test, just increasing totalFee
    const paymentTxParams = {
      ...appCallParams,
      payFlags: { totalFee: 3000 }, // john can support upto 3 txns
      appArgs: ['str:pay'],
      accounts: [elon.address]
    };
    runtime.executeTx(paymentTxParams);
    syncAccounts();

    // note that only 3ALGO are deducted (and not fees)
    assert.equal(appAccount.balance(), appAccountBalBefore - BigInt(3e6));
  });

  it("empty contract's account to txn.accounts[1] if close remainder to is passed", function () {
    const appAccountBalBefore = appAccount.balance();
    const bobBalBefore = bob.balance();
    assert.isAbove(Number(appAccountBalBefore), 0);

    // empties contract's ALGO's to elon (after deducting fees)
    const paymentTxParams = {
      ...appCallParams,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:pay_with_close_rem_to'],
      accounts: [bob.address]
    };
    runtime.executeTx(paymentTxParams);
    syncAccounts();

    assert.equal(appAccount.balance(), 0n);
    assert.equal(bob.balance(), bobBalBefore + appAccountBalBefore - 1000n);
  });
});
