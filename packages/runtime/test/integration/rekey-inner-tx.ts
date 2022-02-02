import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { DeployedAppTxReceipt } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

// default initial balance
const baseBalance = 20e9;
// default fee
const fee = 1000;

// default amount use for transfer
const amount = 1000n;

function rekeyMessageError (spend: string, signer: string): string {
  return `Should have been authorized by ${spend} but was actually authorized by ${signer}`;
}

/**
 * @TODO add test case rekey appl to account
 * https://www.pivotaltracker.com/n/projects/2452320/stories/180976984
 */
describe("Rekey to application", function () {
  useFixture("inner-transaction");

  let master: AccountStore;
  let alice: AccountStore;
  let bob: AccountStore;
  let john: AccountStore;

  let runtime: Runtime;
  let appInfo: DeployedAppTxReceipt;
  let txnParams: types.ExecParams;

  function syncAccounts (): void {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    john = runtime.getAccount(john.address);
    master = runtime.getAccount(master.address);
  }

  this.beforeEach(() => {
    master = new AccountStore(baseBalance);
    alice = new AccountStore(baseBalance);
    bob = new AccountStore(baseBalance);
    john = new AccountStore(baseBalance);
    // init runtime
    runtime = new Runtime([alice, bob, john, master]);

    const flag = {
      sender: master.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };

    appInfo = runtime.deployApp("rekey-approval-payment.py", "clear.teal", flag, {});
  });

  describe("Rekey account to application", function () {
    this.beforeEach(() => {
      txnParams = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 0n,
        payFlags: {
          totalFee: 1000,
          rekeyTo: getApplicationAddress(appInfo.appID)
        }
      };

      runtime.executeTx(txnParams);
      syncAccounts();
    });

    it("check account after rekey", () => {
      assert.equal(alice.getSpendAddress(), getApplicationAddress(appInfo.appID));
    });

    it("transfer algob by inner transaction", () => {
      const masterBalanceBefore = master.amount;
      const aliceBalanceBefore = alice.amount;
      const bobBalanceBefore = bob.amount;

      txnParams = {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master.account,
        appID: appInfo.appID,
        accounts: [alice.address, bob.address],
        appArgs: ["str:transfer_algo", `int:${amount}`],
        payFlags: {
          totalFee: fee
        }
      };

      runtime.executeTx(txnParams);
      syncAccounts();

      const masterBalanceAfter = master.amount;
      const aliceBalanceAfter = alice.amount;
      const bobBalanceAfter = bob.amount;

      // fee for send transaction to network
      assert.equal(masterBalanceBefore, masterBalanceAfter + BigInt(fee));
      // include fee and amount use for inner transaction
      assert.equal(aliceBalanceBefore, aliceBalanceAfter + amount + BigInt(fee));
      // bob will receive `amount` microAlgos
      assert.equal(bobBalanceBefore + amount, bobBalanceAfter);
    });

    it("Should failed: contract can't transfer asset if account not rekey to contract", () => {
      // transfer ALGO from bob to alice by contract, but bob didn't rekey to contract.
      txnParams = {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: master.account,
        appID: appInfo.appID,
        accounts: [bob.address, alice.address],
        appArgs: ["str:transfer_algo", `int:${amount}`],
        payFlags: {
          totalFee: fee
        }
      };

      // should failed
      expectRuntimeError(
        () => runtime.executeTx(txnParams),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(bob.getSpendAddress(), getApplicationAddress(appInfo.appID))
      );
    });
  });
});
