import { Interpreter } from "algorand-js/src";
import { ERRORS } from "algorand-js/src/errors/errors-list";
import { expectTealErrorAsync } from "algorand-js/test/helpers/errors";
import { assert } from "chai";

import { useEnvironment } from "../helpers/environment";
import { useFixtureProject } from "../helpers/project";
import { Runtime } from "../helpers/runtime";
import { MockAccount } from "../mocks/state";

describe("Algorand Smart Contracts", function () {
  useFixtureProject("smart-contracts");
  useEnvironment();
  const escrow = new MockAccount(100000000); // 100 ALGO
  const john = new MockAccount(100);

  let runtime: Runtime;
  let interpreter: Interpreter;

  this.beforeAll(function () {
    runtime = new Runtime(interpreter);
  });

  this.beforeEach(function () {
    interpreter = new Interpreter();
    runtime.interpreter = interpreter;
  });

  it("should update the balance if logic is correct", async function () {
    const tealFile = 'escrow-account.teal';

    // check initial balance
    assert.equal(escrow.balance(), 100000000);
    assert.equal(john.balance(), 100);

    const txnParams = {
      type: 0, // payment
      sign: 0,
      fromAccount: escrow.account,
      toAccountAddr: john.address,
      amountMicroAlgos: 100,
      payFlags: { totalFee: 1000 }
    };

    // execute transaction
    await runtime.execute(txnParams, tealFile, [], [escrow, john]);

    assert.equal(escrow.balance(), 99999900); // check if funds are withdrawn
    assert.equal(john.balance(), 200);
  });

  it("should throw error if logic is incorrect", async function () {
    const tealFile = 'incorrect-logic.teal';

    // initial balance
    const escrowBal = escrow.balance();
    const johnBal = john.balance();

    const txnParams = {
      type: 0, // payment
      sign: 0,
      fromAccount: escrow.account,
      toAccountAddr: john.address,
      amountMicroAlgos: 50,
      payFlags: { totalFee: 1000 }
    };

    // execute transaction (should fail is logic is incorrect)
    await expectTealErrorAsync(
      async () => await runtime.execute(txnParams, tealFile, [], [escrow, john]),
      ERRORS.TEAL.INVALID_STACK_ELEM
    );

    // verify account balance remains unchanged
    assert.equal(escrow.balance(), escrowBal);
    assert.equal(john.balance(), johnBal);
  });
});
