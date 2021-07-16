import { types } from "@algo-builder/web";
import { ExecParams } from "@algo-builder/web/build/types";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("Pooled Transaction Fees Test", function () {
  useFixture("app-update");
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE; // 1000 to cover fee
  let john = new AccountStore(1e30);
  let alice = new AccountStore(minBalance);
  let bob = new AccountStore(minBalance);

  let runtime: Runtime;

  this.beforeEach(async function () {
    runtime = new Runtime([john, alice, bob]); // setup test
  });

  // helper function
  function syncAccounts (): void {
    john = runtime.getAccount(john.address);
    bob = runtime.getAccount(bob.address);
    alice = runtime.getAccount(alice.address);
  }

  it("Should pass if second account doesn't pay fees and first account is covering fees", () => {
    const amount = 1e4 + 122;
    const initialBalance = john.balance();
    console.log("ACCOunts john ", john.address);
    console.log("ACCOunts alice ", alice.address);
    console.log("ACCOunts bob ", bob.address);
    // group with fee distribution
    const groupTx: ExecParams[] = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: 2000, flatFee: true }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: 0, flatFee: true }
      }
    ];

    runtime.executeTx(groupTx);

    syncAccounts();
    assert.equal(bob.balance(), BigInt(minBalance + amount));
    assert.equal(alice.balance(), BigInt(minBalance));
    assert.equal(john.balance(), initialBalance - BigInt(amount));
  });
});
