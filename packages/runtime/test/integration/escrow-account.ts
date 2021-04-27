/* eslint sonarjs/no-duplicate-string: 0 */
import { LogicSig } from "algosdk";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { ExecParams, SignType, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { johnAccount } from "../mocks/account";

const minBalance = BigInt(ALGORAND_ACCOUNT_MIN_BALANCE + 1000); // 1000 to cover fee
const initialEscrowHolding = minBalance + BigInt(1000e6);
const initialJohnHolding = minBalance + 500n;

describe("Algorand Stateless Smart Contracts (Contract Account Mode) - Escrow Account Example", function () {
  useFixture("escrow-account");
  const john = new AccountStore(initialJohnHolding, johnAccount); // 0.005 ALGO
  const admin = new AccountStore(1e12);
  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.LogicSignature,
    fromAccountAddr: admin.account.addr,
    toAccountAddr: john.address,
    lsig: {} as LogicSig,
    amountMicroAlgos: initialEscrowHolding,
    payFlags: { totalFee: 1000 }
  };

  let runtime: Runtime;
  let escrow: AccountStore;
  let lsig: LogicSig;
  this.beforeAll(function () {
    runtime = new Runtime([john, admin]); // setup test
    lsig = runtime.getLogicSig(getProgram('escrow.teal'), []);
    escrow = runtime.getAccount(lsig.address());

    // fund escrow account
    txnParams.toAccountAddr = escrow.address;
    // execute transaction
    runtime.executeTx({
      ...txnParams,
      sign: SignType.SecretKey,
      fromAccount: admin.account
    });
    escrow = runtime.getAccount(escrow.address);

    // update transaction parameters
    txnParams.fromAccountAddr = escrow.account.addr;
    txnParams.toAccountAddr = john.address;
    txnParams.amountMicroAlgos = 100n;
    txnParams.lsig = lsig;
  });

  it("should withdraw funds from escrow if txn params are correct", function () {
    // check initial balance
    assert.equal(escrow.balance(), initialEscrowHolding);
    assert.equal(john.balance(), initialJohnHolding);

    runtime.executeTx(txnParams);

    // check final state (updated accounts)
    assert.equal(runtime.getAccount(escrow.address).balance(), initialEscrowHolding - 1100n); // check if 100 microAlgo's + fee are withdrawn
    assert.equal(runtime.getAccount(john.address).balance(), initialJohnHolding + 100n);
  });

  it("should reject transaction if amount > 100", function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 500n;

    // execute transaction (should fail as amount = 500)
    expectRuntimeError(
      () => runtime.executeTx(invalidParams),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if Fee > 10000", function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.payFlags = { totalFee: 12000 };

    // execute transaction (should fail as fee is 12000)
    expectRuntimeError(
      () => runtime.executeTx(invalidParams),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if type is not `pay`", function () {
    const invalidParams: ExecParams = {
      ...txnParams,
      type: TransactionType.TransferAsset,
      assetID: 1111,
      amount: 10n // asset amount
    };

    // execute transaction (should fail as transfer type is asset)
    expectRuntimeError(
      () => runtime.executeTx(invalidParams),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if receiver is not john", function () {
    const bob = new AccountStore(100);
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.toAccountAddr = bob.address;

    // execute transaction (should fail as receiver is bob)
    expectRuntimeError(
      () => runtime.executeTx(invalidParams),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should close escrow account if closeRemainderTo is passed", function () {
    const initialEscrowBal = runtime.getAccount(escrow.address).balance();
    const initialJohnBal = runtime.getAccount(john.address).balance();

    assert.isAbove(Number(initialEscrowBal), 0); // initial balance should be > 0

    const closeParams: ExecParams = {
      ...txnParams,
      amountMicroAlgos: 0n,
      payFlags: {
        totalFee: 1000,
        closeRemainderTo: john.address
      }
    };
    runtime.executeTx(closeParams);

    assert.equal(runtime.getAccount(escrow.address).balance(), 0n);
    assert.equal(runtime.getAccount(john.address).balance(), (initialJohnBal + initialEscrowBal) - 1000n);
  });
});
