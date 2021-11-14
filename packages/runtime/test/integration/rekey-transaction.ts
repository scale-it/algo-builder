import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const baseBalance = 1e8;

const fee = 1000;

describe("Rekey Transaction testing", function () {
  useFixture("basic-teal");
  let alice: AccountStore;
  let bob: AccountStore;
  let runtime: Runtime;
  let txnParams: types.AlgoTransferParam;

  const amount = 1000n;
  this.beforeAll(async function () {
    alice = new AccountStore(baseBalance);
    bob = new AccountStore(baseBalance);
    runtime = new Runtime([alice, bob]);

    txnParams = {
      type: types.TransactionType.TransferAlgo, // payment
      sign: types.SignType.SecretKey,
      fromAccount: alice.account,
      toAccountAddr: bob.address,
      amountMicroAlgos: amount,
      payFlags: { totalFee: fee }
    };
  });

  // helper function
  function syncAccounts (): void {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
  }

  it("Should rekey success", function () {
    runtime.executeTx({
      ...txnParams,
      rekey: bob.account.addr
    });

    syncAccounts();

    assert.isNotNull(alice.account.authAccount);
    assert.equal(alice.account.authAccount?.addr, bob.address);
  });

  it("Should transfer ALGO by auth account", function () {
    const aliceBalanceBefore = alice.balance();
    const bobBalanceBefore = bob.balance();
    runtime.executeTx({
      ...txnParams,
      fromAccount: bob.account,
      fromAccountAddr: alice.address
    });
    syncAccounts();
    const aliceBalanceAfter = alice.balance();
    const bobBalanceAfter = bob.balance();
    assert.equal(aliceBalanceBefore, aliceBalanceAfter + BigInt(fee) + amount);
    assert.equal(bobBalanceBefore + amount, bobBalanceAfter);
  });

  it("Should fail if singer is not auth account", function () {
    expectRuntimeError(
      () => runtime.executeTx({
        ...txnParams,
        fromAccount: alice.account,
        fromAccountAddr: alice.address
      }),
      RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT
    );
  });
});
