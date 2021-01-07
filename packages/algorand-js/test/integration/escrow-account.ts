/* eslint sonarjs/no-duplicate-string: 0 */
import { ExecParams, SignType, TransactionType } from "@algorand-builder/algob/src/types";
import { assert } from "chai";

import { ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/index";
import { StoreAccountImpl } from "../../src/runtime/account";
import { getAcc } from "../helpers/account";
import { expectTealErrorAsync } from "../helpers/errors";
import { johnAccount } from "../mocks/account";

const initialEscrowHolding = 10000000006n;
const initialJohnHolding = 500n;

describe("Algorand Stateless Smart Contracts", function () {
  const escrow = new StoreAccountImpl(initialEscrowHolding); // 1000 ALGO
  const john = new StoreAccountImpl(initialJohnHolding, johnAccount); // 0.005 ALGO
  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.SecretKey,
    fromAccount: escrow.account,
    toAccountAddr: john.address,
    amountMicroAlgos: 100n,
    payFlags: { totalFee: 1000 }
  };

  let runtime: Runtime;
  this.beforeAll(function () {
    runtime = new Runtime([escrow, john]); // setup test
  });

  it("should withdraw funds from escrow if txn params are correct", async function () {
    // check initial balance
    assert.equal(escrow.balance(), initialEscrowHolding);
    assert.equal(john.balance(), initialJohnHolding);

    // execute transaction
    await runtime.executeTx(txnParams, 'escrow.teal', []);

    // check final state (updated accounts)
    assert.equal(getAcc(runtime, escrow).balance(), initialEscrowHolding - 100n); // check if 100 microAlgo's are withdrawn
    assert.equal(getAcc(runtime, john).balance(), initialJohnHolding + 100n);
  });

  it("should reject transaction if amount > 100", async function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 500;

    // execute transaction (should fail as amount = 500)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if Fee > 10000", async function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.payFlags = { totalFee: 12000 };

    // execute transaction (should fail as fee is 12000)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if type is not `pay`", async function () {
    const invalidParams: ExecParams = {
      ...txnParams,
      type: TransactionType.TransferAsset,
      assetID: 1111,
      amount: 10 // asset amount
    };

    // execute transaction (should fail as transfer type is asset)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if receiver is not john", async function () {
    const bob = new StoreAccountImpl(100);
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.toAccountAddr = bob.address;

    // execute transaction (should fail as receiver is bob)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, 'escrow.teal', []),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });
});
