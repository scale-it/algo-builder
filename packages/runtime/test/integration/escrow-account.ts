/* eslint sonarjs/no-duplicate-string: 0 */
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { LogicSig } from "../../src/logicsig";
import { AlgoTransferParam, ExecParams, SignType, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { johnAccount } from "../mocks/account";

const minBalance = BigInt(ALGORAND_ACCOUNT_MIN_BALANCE + 1000); // 1000 to cover fee
const initialEscrowHolding = minBalance + BigInt(1000e6);
const initialJohnHolding = minBalance + 500n;
const fee = 1000;

// The following test cases are used in Testing TEAL guide,
// and in tutorial 4 at developer.algorand.org. This is a simplified version of the
// test above.
// NOTE: when updating this test, you must update /docs/guide/testing-teal.md
describe("Logic Signature: Escrow Account", function () {
  useFixture("escrow-account");

  let john = new AccountStore(initialJohnHolding, johnAccount); // 0.005 ALGO
  const admin = new AccountStore(1e12);
  let runtime: Runtime;

  // we can't load teal code and create an escrow, because in this test we are loading a
  // fixture environment, which happens in `beforeAll`. So, consequently we need to move
  // initialization of lsig and escrow to beforeAll
  let lsig: LogicSig;
  let escrow: AccountStore;
  let paymentTxParams: AlgoTransferParam;

  this.beforeAll(function () {
    runtime = new Runtime([john, admin]); // setup runtime
    lsig = runtime.getLogicSig(getProgram('escrow.teal'), []);
    escrow = runtime.getAccount(lsig.address());
    paymentTxParams = {
      type: TransactionType.TransferAlgo,
      sign: SignType.LogicSignature,
      lsig: lsig,
      fromAccountAddr: escrow.address,
      toAccountAddr: john.address,
      amountMicroAlgos: 100n,
      payFlags: { totalFee: fee }
    };
  });

  // helper function
  function syncAccounts (): void {
    john = runtime.getAccount(john.address);
    escrow = runtime.getAccount(escrow.address);
  }

  it("should fund escrow account", function () {
    runtime.executeTx({
      type: TransactionType.TransferAlgo, // payment
      sign: SignType.SecretKey,
      fromAccount: admin.account,
      toAccountAddr: escrow.address,
      amountMicroAlgos: initialEscrowHolding,
      payFlags: { totalFee: fee }
    });

    // check initial balance
    syncAccounts();
    assert.equal(escrow.balance(), initialEscrowHolding);
    assert.equal(john.balance(), initialJohnHolding);
  });

  it("should withdraw funds from escrow if txn params are correct", function () {
    runtime.executeTx(paymentTxParams);

    // check final state (updated accounts)
    syncAccounts();
    assert.equal(escrow.balance(), initialEscrowHolding - 100n - BigInt(fee));
    assert.equal(john.balance(), initialJohnHolding + 100n);
  });

  it("should reject transaction if amount > 100", function () {
    expectRuntimeError(
      () => runtime.executeTx({ ...paymentTxParams, amountMicroAlgos: 500n }),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if Fee > 10000", function () {
    expectRuntimeError(
      () => runtime.executeTx({ ...paymentTxParams, payFlags: { totalFee: 0.1e6 } }),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if type is not `pay`", function () {
    expectRuntimeError(
      () => runtime.executeTx({
        ...paymentTxParams,
        type: TransactionType.TransferAsset,
        assetID: 1111,
        amount: 10n // asset amount
      }),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should reject transaction if receiver is not john", function () {
    const bob = new AccountStore(100);
    expectRuntimeError(
      () => runtime.executeTx({ ...paymentTxParams, toAccountAddr: bob.address }),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });

  it("should correctly close escrow account if closeRemainderTo is passed", function () {
    syncAccounts();
    const escrowBal = escrow.balance();
    const johnBal = john.balance();
    assert.isAbove(Number(escrowBal), 0); // escrow balance should be > 0

    const closeParams: ExecParams = {
      ...paymentTxParams,
      amountMicroAlgos: 0n,
      payFlags: {
        totalFee: 1000,
        closeRemainderTo: john.address
      }
    };
    runtime.executeTx(closeParams);

    syncAccounts();
    assert.equal(escrow.balance(), 0n);
    assert.equal(john.balance(), (johnBal + escrowBal) - BigInt(fee));
  });
});
