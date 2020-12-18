import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Interpreter, Runtime } from "../../src/index";
import { SdkAccountImpl } from "../../src/Runtime/account";
import { expectTealErrorAsync } from "../helpers/errors";
import { useFixtureProject } from "../helpers/project";

describe("Algorand Smart Contracts", function () {
  useFixtureProject("smart-contracts");

  const escrow = new SdkAccountImpl(100000000); // 100 ALGO
  const john = new SdkAccountImpl(100);
  const txnParams = {
    type: 0, // payment
    sign: 0,
    fromAccount: escrow.account,
    toAccountAddr: john.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 1000 }
  };

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
    // check initial balance
    assert.equal(escrow.balance(), 100000000);
    assert.equal(john.balance(), 100);

    // execute transaction
    await runtime.executeTx(txnParams, 'basic.teal', [], [escrow, john]);

    assert.equal(escrow.balance(), 99999900); // check if funds are withdrawn
    assert.equal(john.balance(), 200);
  });

  it("should throw error if logic is incorrect", async function () {
    // initial balance
    const escrowBal = escrow.balance();
    const johnBal = john.balance();

    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 50;

    // execute transaction (should fail is logic is incorrect)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'incorrect-logic.teal', [], [escrow, john]),
      ERRORS.TEAL.INVALID_STACK_ELEM
    );

    // verify account balance remains unchanged
    assert.equal(escrow.balance(), escrowBal);
    assert.equal(john.balance(), johnBal);
  });
});
