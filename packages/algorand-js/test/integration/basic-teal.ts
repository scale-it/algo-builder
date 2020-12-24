import { ExecParams, SignType, TransactionType } from "algob/src/types";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/index";
import { StoreAccountImpl } from "../../src/runtime/account";
import { getAcc } from "../helpers/account";
import { expectTealErrorAsync } from "../helpers/errors";

describe("Algorand Smart Contracts", function () {
  let john = new StoreAccountImpl(1000);
  let bob = new StoreAccountImpl(500);

  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.SecretKey,
    fromAccount: john.account,
    toAccountAddr: bob.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 1000 }
  };

  let runtime: Runtime;
  this.beforeAll(function () {
    runtime = new Runtime([john, bob]); // setup test
  });

  // update account state after each execution
  afterEach(function () {
    john = getAcc(runtime, john);
    bob = getAcc(runtime, bob);
  });

  it("should send algo's from john to bob if stateless teal logic is correct", async function () {
    // check initial balance
    assert.equal(john.balance(), 1000);
    assert.equal(bob.balance(), 500);

    // execute transaction
    await runtime.executeTx(txnParams, 'basic.teal', []);

    // get final state (updated accounts)
    const johnAcc = getAcc(runtime, john);
    const bobAcc = getAcc(runtime, bob);
    assert.equal(johnAcc.balance(), 900); // check if 100 microAlgo's are withdrawn
    assert.equal(bobAcc.balance(), 600);
  });

  it("should throw error if logic is incorrect", async function () {
    // initial balance
    const johnBal = john.balance();
    const bobBal = bob.balance();

    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 50;

    // execute transaction (should fail is logic is incorrect)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'incorrect-logic.teal', []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // get final state (updated accounts)
    const johnAcc = getAcc(runtime, john);
    const bobAcc = getAcc(runtime, bob);

    // verify account balance in updated state remains unchanged
    assert.equal(johnAcc.balance(), johnBal);
    assert.equal(bobAcc.balance(), bobBal);
  });
});
