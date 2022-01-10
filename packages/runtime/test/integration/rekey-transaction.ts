import { types } from "@algo-builder/web";
import { LogicSigAccount } from "algosdk";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

// default initial balance
const baseBalance = 1e8;
// default fee
const fee = 1000;

describe("Re-keying transaction", function () {
  let alice: AccountStore;
  let bob: AccountStore;
  let runtime: Runtime;

  let txnParams: types.AlgoTransferParam;

  // fetch account informaton
  function syncAccounts (): void {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
  }

  this.beforeEach(() => {
    // testing accounts
    alice = new AccountStore(baseBalance);
    bob = new AccountStore(baseBalance);
    runtime = new Runtime([alice, bob]);
  });

  describe("Re-key Transaction from account to account", function () {
    const amount = 1000n;

    this.beforeEach(async function () {
      // rekey transaction
      txnParams = {
        type: types.TransactionType.TransferAlgo, // payment
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: bob.address,
        amountMicroAlgos: 0,
        payFlags: { totalFee: fee, rekeyTo: bob.address }
      };

      runtime.executeTx(txnParams);
      syncAccounts();
    });

    it("Check spend account", function () {
      syncAccounts();

      assert.isNotNull(alice.account.spend);
      assert.equal(alice.account.getSpend(), bob.address);
    });

    it("Should transfer ALGO by spend account", function () {
      syncAccounts();
      // balance before rekey
      const aliceBalanceBefore = alice.balance();
      const bobBalanceBefore = bob.balance();

      // transfer ALGO by spend account
      txnParams = {
        type: types.TransactionType.TransferAlgo, // payment
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fee }
      };

      runtime.executeTx(txnParams);

      // check balance of alice and bob after transfer
      syncAccounts();
      const aliceBalanceAfter = alice.balance();
      const bobBalanceAfter = bob.balance();

      // transaction fee paid by `from account` not `signer`
      assert.equal(aliceBalanceBefore, aliceBalanceAfter + amount + BigInt(fee));
      assert.equal(bobBalanceBefore + amount, bobBalanceAfter);
    });

    it("Should fail because signer is not spend account", function () {
      txnParams = {
        type: types.TransactionType.TransferAlgo, // payment
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fee }
      };

      expectRuntimeError(
        () => runtime.executeTx(txnParams),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT
      );
    });
  });

  describe("Re-keying from account to lsig", function () {
    useFixture("basic-teal");
    let lsig: LogicSigAccount;

    this.beforeEach(() => {
      // logicSig
      lsig = runtime.loadLogic('basic.teal');

      txnParams = {
        type: types.TransactionType.TransferAlgo, // payment
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 0,
        payFlags: { totalFee: fee, rekeyTo: lsig.address() }
      };

      runtime.executeTx(txnParams);
      syncAccounts();
    });

    it("Check spend account", () => {
      assert.isNotNull(alice.account.spend);
      assert.equal(alice.account.getSpend(), lsig.address());
    });

    it("Should have transfer permission", () => {
      txnParams = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: 1000n,
        lsig: lsig,
        payFlags: { totalFee: fee }
      };
      runtime.executeTx(txnParams);
    });

    it("Should failed if lsig is not spend account", () => {
      const anotherLsig = runtime.loadLogic('another-basic.teal');

      txnParams = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: 1000n,
        lsig: anotherLsig,
        payFlags: { totalFee: fee }
      };

      expectRuntimeError(
        () => runtime.executeTx(txnParams),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT
      );
    });
  });

  describe("Re-keying from lsig to lsig", function () {
    this.beforeEach(() => {

    });
  });
  describe("Re-keying from lsig to account", function () {
  });
});
