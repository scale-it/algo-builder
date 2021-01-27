import { ExecParams, SignType, TransactionType } from "@algorand-builder/algob/src/types";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccount } from "../../src/index";
import { expectTealError } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

const initialJohnHolding = 1000;
const initialBobHolding = 500;

describe("Algorand Smart Contracts", function () {
  useFixture("basic-teal");
  let john = new StoreAccount(initialJohnHolding);
  let bob = new StoreAccount(initialBobHolding);

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
    john = runtime.getAccount(john.address);
    bob = runtime.getAccount(bob.address);
  });

  it("should send algo's from john to bob if stateless teal logic is correct", function () {
    // check initial balance
    assert.equal(john.balance(), initialJohnHolding);
    assert.equal(bob.balance(), initialBobHolding);

    // execute transaction
    runtime.executeTx(txnParams, getProgram('basic.teal'), []);

    // get final state (updated accounts)
    const johnAcc = runtime.getAccount(john.address);
    const bobAcc = runtime.getAccount(bob.address);
    assert.equal(johnAcc.balance(), initialJohnHolding - 100); // check if 100 microAlgo's are withdrawn
    assert.equal(bobAcc.balance(), initialBobHolding + 100);
  });

  it("should throw error if logic is incorrect", function () {
    // initial balance
    const johnBal = john.balance();
    const bobBal = bob.balance();

    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 50;

    // execute transaction (should fail is logic is incorrect)
    expectTealError(
      () => runtime.executeTx(invalidParams, getProgram('incorrect-logic.teal'), []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // get final state (updated accounts)
    const johnAcc = runtime.getAccount(john.address);
    const bobAcc = runtime.getAccount(bob.address);

    // verify account balance in updated state remains unchanged
    assert.equal(johnAcc.balance(), johnBal);
    assert.equal(bobAcc.balance(), bobBal);
  });
});
