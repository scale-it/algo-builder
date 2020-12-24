/* eslint sonarjs/no-duplicate-string: 0 */
import { TransactionType } from "algob";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/index";
import { StoreAccountImpl } from "../../src/runtime/account";
import { getAcc } from "../helpers/account";
import { expectTealErrorAsync } from "../helpers/errors";
import { johnAccount } from "../mocks/account";

describe("Algorand Stateless Smart Contracts", function () {
  const escrow = new StoreAccountImpl(1000000000); // 1000 ALGO
  const john = new StoreAccountImpl(500, johnAccount); // 0.005 ALGO
  // set up transaction paramenters
  const txnParams = {
    type: TransactionType.TransferAlgo as number, // payment
    sign: 0,
    fromAccount: escrow.account,
    toAccountAddr: john.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 1000 }
  };

  let runtime: Runtime;
  this.beforeAll(function () {
    runtime = new Runtime([escrow, john]); // setup test
  });

  it("should withdraw funds from escrow on correct txn params", async function () {
    // check initial balance
    assert.equal(escrow.balance(), 1000000000);
    assert.equal(john.balance(), 500);

    // execute transaction
    await runtime.executeTx(txnParams, 'escrow.teal', []);

    // check final state (updated accounts)
    assert.equal(getAcc(runtime, escrow).balance(), 999999900); // check if 100 microAlgo's are withdrawn
    assert.equal(getAcc(runtime, john).balance(), 600);
  });

  it("should reject transaction if amount > 100", async function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 500;

    // execute transaction (should fail as amount = 500)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.LOGIC_REJECTION
    );
  });

  it("should reject transaction if Fee > 10000", async function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.payFlags = { totalFee: 12000 };

    // execute transaction (should fail as fee is 12000)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.LOGIC_REJECTION
    );
  });

  it("should reject transaction type is not `pay`", async function () {
    const invalidParams = {
      ...txnParams,
      type: TransactionType.TransferAsset as number, // asset transfer
      assetID: 1111
    };

    // execute transaction (should fail as transfer type is asset)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.LOGIC_REJECTION
    );
  });

  it("should reject transaction if receiver is not john", async function () {
    const bob = new StoreAccountImpl(100);
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.toAccountAddr = bob.address;

    // execute transaction (should fail as receiver is bob)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.LOGIC_REJECTION
    );
  });
});
