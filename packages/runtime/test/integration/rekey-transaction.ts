import { types } from "@algo-builder/web";
import { LogicSigAccount } from "algosdk";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

// default initial balance
const baseBalance = 20e9;
// default fee
const fee = 1000;

// defaunt amount use for transfer
const amount = 1000n;

function rekeyMessageError (spend: string, signer: string): string {
  return `Should have been authorized by ${spend} but was actually authorized by ${signer}`;
}

describe("Re-keying transactions", function () {
  useFixture('basic-teal');

  let master: AccountStore;
  let alice: AccountStore;
  let bob: AccountStore;
  let john: AccountStore;
  let lsigAccount: AccountStore;
  let cloneLsigAccount: AccountStore;

  let lsig: LogicSigAccount;
  let cloneLsig: LogicSigAccount;

  let runtime: Runtime;

  let txParam: types.AlgoTransferParam;

  // fetch basic account informaton
  function syncAccounts (): void {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    john = runtime.getAccount(john.address);
    lsigAccount = runtime.getAccount(lsig.address());
    cloneLsigAccount = runtime.getAccount(cloneLsig.address());
  }

  this.beforeEach(() => {
    // accounts
    master = new AccountStore(baseBalance);
    alice = new AccountStore(baseBalance);
    bob = new AccountStore(baseBalance);
    john = new AccountStore(baseBalance);
    // init runtime
    runtime = new Runtime([alice, bob, john, master]);

    // lsig
    lsig = runtime.loadLogic('basic.teal');
    cloneLsig = runtime.loadLogic('another-basic.teal');

    // fund to logic sign address
    runtime.fundLsig(master.account, lsig.address(), 10e8);
    runtime.fundLsig(master.account, cloneLsig.address(), 10e8);

    syncAccounts();
  });

  it("Validate spend address after init", () => {
    assert.equal(alice.getSpendAddress(), alice.address);
    assert.equal(bob.getSpendAddress(), bob.address);
    assert.equal(lsigAccount.getSpendAddress(), lsigAccount.address);
    assert.equal(cloneLsigAccount.getSpendAddress(), cloneLsigAccount.address);
  });

  describe("Account to account", function () {
    this.beforeEach(() => {
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 0,
        payFlags: {
          totalFee: fee,
          rekeyTo: bob.address
        }
      };

      runtime.executeTx(txParam);
      syncAccounts();
    });

    it("Spend address of alice account should changed to bob account", function () {
      assert.isNotNull(alice.account.spend);
      assert.equal(alice.getSpendAddress(), bob.address);
    });

    it("Should transfer ALGO by spend account", function () {
      syncAccounts();
      // balance before rekey
      const aliceBalanceBefore = alice.balance();
      const bobBalanceBefore = bob.balance();

      // transfer ALGO by spend account
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fee }
      };

      runtime.executeTx(txParam);

      // check balance of alice and bob after transfer
      syncAccounts();
      const aliceBalanceAfter = alice.balance();
      const bobBalanceAfter = bob.balance();

      // transaction fee paid by `from account` not `signer`
      assert.equal(aliceBalanceBefore, aliceBalanceAfter + amount + BigInt(fee));
      assert.equal(bobBalanceBefore + amount, bobBalanceAfter);
    });

    it("Should fail because signer account is invalid spend address", function () {
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fee }
      };

      expectRuntimeError(
        () => runtime.executeTx(txParam),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(alice.getSpendAddress(), alice.address)
      );
    });

    describe("Rekey an already rekeyed account", function () {
      this.beforeEach(() => {
        txParam = {
          type: types.TransactionType.TransferAlgo,
          sign: types.SignType.SecretKey,
          fromAccount: bob.account,
          fromAccountAddr: alice.address,
          toAccountAddr: bob.address,
          amountMicroAlgos: amount,
          payFlags: { totalFee: fee, rekeyTo: lsigAccount.address }
        };

        runtime.executeTx(txParam);
        syncAccounts();
      });

      it("Check spend key", function () {
        assert.equal(alice.getSpendAddress(), lsigAccount.address);
      });
    });

    describe("Rekey again back to orginal account", function () {
      this.beforeEach(() => {
        txParam = {
          type: types.TransactionType.TransferAlgo,
          sign: types.SignType.SecretKey,
          fromAccount: bob.account,
          fromAccountAddr: alice.address,
          toAccountAddr: bob.address,
          amountMicroAlgos: amount,
          payFlags: { totalFee: fee, rekeyTo: alice.address }
        };

        runtime.executeTx(txParam);
        syncAccounts();
      });

      it("Check spend key", function () {
        assert.equal(alice.getSpendAddress(), alice.address);
      });
    });
  });

  describe("Account to Lsig", function () {
    this.beforeEach(() => {
      // create rekey transaction
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 0,
        payFlags: { totalFee: fee, rekeyTo: lsigAccount.address }
      };

      runtime.executeTx(txParam);
      syncAccounts();
    });

    it("spend address of alice account should be lsig address", () => {
      assert.isNotNull(alice.account.spend);
      assert.equal(alice.getSpendAddress(), lsigAccount.address);
    });

    it("Transfer ALGO by valid spend account", () => {
      // balance before rekey
      const aliceBalanceBefore = alice.balance();
      const bobBalanceBefore = bob.balance();

      // transfer ALGO use lsig
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        lsig: lsig,
        payFlags: { totalFee: fee }
      };

      runtime.executeTx(txParam);

      // check balance of alice and bob after transfer
      syncAccounts();
      const aliceBalanceAfter = alice.balance();
      const bobBalanceAfter = bob.balance();

      // transaction fee will paid by `from account` not `signer account`
      assert.equal(aliceBalanceBefore, aliceBalanceAfter + amount + BigInt(fee));
      assert.equal(bobBalanceBefore + amount, bobBalanceAfter);
    });

    it("Should failed because cloneLsig is invalid spend address of alice account", () => {
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        lsig: cloneLsig,
        payFlags: { totalFee: fee }
      };

      expectRuntimeError(
        () => runtime.executeTx(txParam),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(alice.getSpendAddress(), cloneLsigAccount.address)
      );
    });

    it("Should failed: when use another account", () => {
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        fromAccountAddr: alice.address,
        toAccountAddr: bob.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fee }
      };

      expectRuntimeError(
        () => runtime.executeTx(txParam),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(alice.getSpendAddress(), john.address)
      );
    });
  });

  describe("Lsig to Lsig", function () {
    this.beforeEach(() => {
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsig.address(),
        toAccountAddr: lsig.address(),
        amountMicroAlgos: 0,
        lsig: lsig,
        payFlags: {
          totalFee: fee,
          rekeyTo: cloneLsigAccount.address
        }
      };
      runtime.executeTx(txParam);
      syncAccounts();
    });

    it("Spend address of lsig should be cloneLsig address", () => {
      assert.isNotNull(lsigAccount.account.spend);
      assert.equal(lsigAccount.getSpendAddress(), cloneLsigAccount.address);
    });

    it("Transfer ALGO by valid spend account", () => {
      // balance before rekey
      const lsigBalanceBefore = lsigAccount.balance();
      const aliceBalanceBefore = alice.balance();
      // transfer ALGO use lsig
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsigAccount.address,
        toAccountAddr: alice.address,
        amountMicroAlgos: amount,
        lsig: cloneLsig,
        payFlags: { totalFee: fee }
      };

      runtime.executeTx(txParam);

      // check balance of alice and bob after transfer
      syncAccounts();
      const lsigBalanceAfter = lsigAccount.balance();
      const aliceBalanceAfter = alice.balance();

      // transaction fee will paid by `from account` not `signer account`
      assert.equal(lsigBalanceBefore, lsigBalanceAfter + amount + BigInt(fee));
      assert.equal(aliceBalanceBefore + amount, aliceBalanceAfter);
    });

    it("Should failed if signer is invalid spend account", () => {
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsigAccount.address,
        toAccountAddr: alice.address,
        amountMicroAlgos: amount,
        lsig: lsig,
        payFlags: { totalFee: fee }
      };

      expectRuntimeError(
        () => runtime.executeTx(txParam),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(lsigAccount.getSpendAddress(), lsigAccount.address)
      );
    });
  });

  describe("Lsig to account", function () {
    this.beforeEach(() => {
      // create rekey transaction
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsig.address(),
        toAccountAddr: lsig.address(),
        amountMicroAlgos: 0,
        lsig: lsig,
        payFlags: {
          totalFee: fee,
          rekeyTo: bob.address
        }
      };
      runtime.executeTx(txParam);
      syncAccounts();
    });

    it("Spend address of lsig should change to bob", () => {
      assert.isNotNull(lsigAccount.account.spend);
      assert.equal(lsigAccount.getSpendAddress(), bob.address);
    });

    it("Transfer ALGO by spend account", () => {
      // balance before rekey
      const lsigBalanceBefore = lsigAccount.balance();
      const aliceBalanceBefore = alice.balance();
      // transfer ALGO use lsig
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        fromAccountAddr: lsigAccount.address,
        toAccountAddr: alice.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fee }
      };

      runtime.executeTx(txParam);

      // check balance of alice and bob after transfer
      syncAccounts();
      const lsigBalanceAfter = lsigAccount.balance();
      const aliceBalanceAfter = alice.balance();

      // transaction fee will paid by `from account` not `signer account`
      assert.equal(lsigBalanceBefore, lsigBalanceAfter + amount + BigInt(fee));
      assert.equal(aliceBalanceBefore + amount, aliceBalanceAfter);
    });

    it("Should failed if alice is invalid spend address of lsig address", () => {
      txParam = {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        fromAccountAddr: lsigAccount.address,
        toAccountAddr: alice.address,
        amountMicroAlgos: amount,
        payFlags: { totalFee: fee }
      };

      expectRuntimeError(
        () => runtime.executeTx(txParam),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(lsigAccount.getSpendAddress(), alice.address)
      );
    });
  });
});
