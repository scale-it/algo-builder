import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { LogicSig } from "../../src/logicsig";
import { ExecParams, SignType, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const minBalance = BigInt(ALGORAND_ACCOUNT_MIN_BALANCE + 1000); ; // 1000 to cover fee
const initialJohnHolding = minBalance + 2000n;
const initialBobHolding = minBalance + 500n;

describe("Stateless Algorand Smart Contracts delegated signature mode", function () {
  useFixture("basic-teal");
  let john = new AccountStore(initialJohnHolding);
  let bob = new AccountStore(initialBobHolding);

  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.LogicSignature,
    fromAccountAddr: john.account.addr,
    toAccountAddr: bob.address,
    amountMicroAlgos: 100n,
    lsig: {} as LogicSig, // populated below
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
    // get logic signature
    const lsig = runtime.getLogicSig(getProgram('basic.teal'), []);
    lsig.sign(john.account.sk);
    txnParams.lsig = lsig;

    runtime.executeTx(txnParams);

    // get final state (updated accounts)
    const johnAcc = runtime.getAccount(john.address);
    const bobAcc = runtime.getAccount(bob.address);
    assert.equal(johnAcc.balance(), initialJohnHolding - 1100n); // check if (100 microAlgo's + fee of 1000) are withdrawn
    assert.equal(bobAcc.balance(), initialBobHolding + 100n);
  });

  it("should throw error if logic is incorrect", function () {
    // initial balance
    const johnBal = john.balance();
    const bobBal = bob.balance();
    // get logic signature
    const lsig = runtime.getLogicSig(getProgram('incorrect-logic.teal'), []);
    lsig.sign(john.account.sk);
    txnParams.lsig = lsig;

    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 50n;

    // execute transaction (should fail is logic is incorrect)
    expectRuntimeError(
      () => runtime.executeTx(invalidParams),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // get final state (updated accounts)
    const johnAcc = runtime.getAccount(john.address);
    const bobAcc = runtime.getAccount(bob.address);

    // verify account balance in updated state remains unchanged
    assert.equal(johnAcc.balance(), johnBal);
    assert.equal(bobAcc.balance(), bobBal);
  });
});
