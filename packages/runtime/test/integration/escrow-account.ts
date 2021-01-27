/* eslint sonarjs/no-duplicate-string: 0 */
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime, StoreAccount } from "../../src/index";
import { ExecParams, SignType, TransactionType } from "../../src/types";
import { expectTealError } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { johnAccount } from "../mocks/account";

const initialEscrowHolding = 1000e6;
const initialJohnHolding = 500;

describe("Algorand Stateless Smart Contracts", function () {
  useFixture("escrow-account");
  const escrow = new StoreAccount(initialEscrowHolding); // 1000 ALGO
  const john = new StoreAccount(initialJohnHolding, johnAccount); // 0.005 ALGO
  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.SecretKey,
    fromAccount: escrow.account,
    toAccountAddr: john.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 1000 }
  };

  let runtime: Runtime;
  this.beforeAll(function () {
    runtime = new Runtime([escrow, john]); // setup test
  });

  it("should withdraw funds from escrow if txn params are correct", function () {
    // check initial balance
    assert.equal(escrow.balance(), initialEscrowHolding);
    assert.equal(john.balance(), initialJohnHolding);

    // execute transaction
    runtime.executeTx(txnParams, getProgram('escrow.teal'), []);

    // check final state (updated accounts)
    assert.equal(runtime.getAccount(escrow.address).balance(), initialEscrowHolding - 100); // check if 100 microAlgo's are withdrawn
    assert.equal(runtime.getAccount(john.address).balance(), initialJohnHolding + 100);
  });

  it("should reject transaction if amount > 100", function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 500;

    // execute transaction (should fail as amount = 500)
    expectTealError(
      () => runtime.executeTx(invalidParams, getProgram('escrow.teal'), []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if Fee > 10000", function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.payFlags = { totalFee: 12000 };

    // execute transaction (should fail as fee is 12000)
    expectTealError(
      () => runtime.executeTx(invalidParams, getProgram('escrow.teal'), []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if type is not `pay`", function () {
    const invalidParams: ExecParams = {
      ...txnParams,
      type: TransactionType.TransferAsset,
      assetID: 1111,
      amount: 10 // asset amount
    };

    // execute transaction (should fail as transfer type is asset)
    expectTealError(
      () => runtime.executeTx(invalidParams, getProgram('escrow.teal'), []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if receiver is not john", function () {
    const bob = new StoreAccount(100);
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.toAccountAddr = bob.address;

    // execute transaction (should fail as receiver is bob)
    expectTealError(
      () => runtime.executeTx(invalidParams, getProgram('escrow.teal'), []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });
});
