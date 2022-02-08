/* eslint-disable sonarjs/no-duplicate-string */
import { types } from "@algo-builder/web";
import { LogicSigAccount } from "algosdk";
import { assert } from "chai";
import { Address } from "cluster";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../../src/index";
import { AccountStoreI } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

// default initial balance
const baseBalance = 20e9;
// default fee
const FEE = 1000;

// default amount use for transfer
const DEFAULT_AMOUNT = 1000n;

function rekeyMessageError (spend: string, signer: string): string {
  return `Should have been authorized by ${spend} but was actually authorized by ${signer}`;
}

describe("Re-keying transactions", function () {
  useFixture('basic-teal');

  let master: AccountStoreI;
  let alice: AccountStoreI;
  let bob: AccountStoreI;
  let john: AccountStoreI;
  let lsigAccount: AccountStoreI;
  let cloneLsigAccount: AccountStoreI;

  let lsig: LogicSigAccount;
  let cloneLsig: LogicSigAccount;

  let runtime: Runtime;

  let txParams: types.ExecParams;

  // fetch basic account informaton
  function syncAccounts (): void {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    john = runtime.getAccount(john.address);
    lsigAccount = runtime.getAccount(lsig.address());
    cloneLsigAccount = runtime.getAccount(cloneLsig.address());
  }

  function mkTxAlgoTransferFromLsig (
    runtime: Runtime,
    lsig: LogicSigAccount,
    from: AccountStoreI,
    to: AccountStoreI,
    amount: bigint | number,
    payFlags: types.TxParams
  ): void {
    const txParam: types.AlgoTransferParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      lsig: lsig,
      fromAccountAddr: from.address,
      toAccountAddr: to.address,
      amountMicroAlgos: amount,
      payFlags: payFlags
    };

    runtime.executeTx(txParam);
    syncAccounts();
  }

  function mkTxAlgoTransferFromAccount (
    runtime: Runtime,
    signer: AccountStoreI,
    from: AccountStoreI,
    to: AccountStoreI,
    algoAmount: bigint,
    payFlags: types.TxParams
  ): void {
    const txParam: types.AlgoTransferParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: signer.account,
      fromAccountAddr: from.address,
      toAccountAddr: to.address,
      amountMicroAlgos: algoAmount,
      payFlags: payFlags
    };
    runtime.executeTx(txParam);
    syncAccounts();
  };

  function rekeyFromAccount (
    runtime: Runtime, signer: AccountStoreI, from: AccountStoreI, to: AccountStoreI
  ): void {
    mkTxAlgoTransferFromAccount(
      runtime, signer, from, from, 0n,
      {
        totalFee: FEE,
        rekeyTo: to.address
      }
    );
  }

  function rekeyFromLsig (
    runtime: Runtime, lsig: LogicSigAccount, from: AccountStoreI, to: AccountStoreI
  ): void {
    mkTxAlgoTransferFromLsig(
      runtime, lsig, from, from, 0n,
      {
        totalFee: FEE,
        rekeyTo: to.address
      }
    );
  }

  function closeWithAccount (
    runtime: Runtime, signer: AccountStoreI, from: AccountStoreI, closeTo: AccountStoreI
  ): void {
    mkTxAlgoTransferFromAccount(
      runtime, signer, from, from, 0n,
      {
        totalFee: FEE,
        closeRemainderTo: closeTo.address
      }
    );
  }

  function closeWithLsig (
    runtime: Runtime, lsig: LogicSigAccount, from: AccountStoreI, closeTo: AccountStoreI
  ): void {
    mkTxAlgoTransferFromLsig(
      runtime, lsig, from, from, 0n,
      {
        totalFee: FEE,
        closeRemainderTo: closeTo.address
      }
    );
  }

  function verifyTransferAlgoAuthByAccount (
    runtime: Runtime, signer: AccountStoreI, from: AccountStoreI, to: AccountStoreI, algoAmount: bigint
  ): void {
    // balance before rekey
    const fromAccountBalanceBefore = from.balance();
    const toAccountBalanceBefore = to.balance();

    // transfer ALGO by spend account
    mkTxAlgoTransferFromAccount(
      runtime, signer, from, to, algoAmount,
      {
        totalFee: FEE
      }
    );

    const fromAccountBalanceAfter = runtime.getAccount(from.address).balance();
    const toAccountBalanceAfter = runtime.getAccount(to.address).balance();

    // transaction fee paid by `from account` not `signer`
    assert.equal(fromAccountBalanceBefore, fromAccountBalanceAfter + algoAmount + BigInt(FEE));
    assert.equal(toAccountBalanceBefore + algoAmount, toAccountBalanceAfter);
  }

  function verifyTransferAlgoAuthByLsig (
    runtime: Runtime, lsig: LogicSigAccount, from: AccountStoreI, to: AccountStoreI, amount: bigint
  ): void {
    // balance before rekey
    const fromAccountBalanceBefore = from.balance();
    const toAccountBalanceBefore = to.balance();

    // transfer ALGO by spend account
    mkTxAlgoTransferFromLsig(
      runtime, lsig, from, to, amount,
      {
        totalFee: FEE
      }
    );

    const fromAccountBalanceAfter = runtime.getAccount(from.address).balance();
    const toAccountBalanceAfter = runtime.getAccount(to.address).balance();

    // transaction fee paid by `from account` not `signer`
    assert.equal(fromAccountBalanceBefore, fromAccountBalanceAfter + amount + BigInt(FEE));
    assert.equal(toAccountBalanceBefore + amount, toAccountBalanceAfter);
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
      rekeyFromAccount(runtime, alice, alice, bob);
    });

    it("Spend address of alice account should changed to bob account", function () {
      assert.isNotNull(alice.account.spend);
      assert.equal(alice.getSpendAddress(), bob.address);
    });

    it("Should transfer ALGO by spend account", function () {
      // balance before rekey
      verifyTransferAlgoAuthByAccount(runtime, bob, alice, bob, DEFAULT_AMOUNT);
    });

    it("Should fail because signer account is invalid spend address", function () {
      expectRuntimeError(
        () => mkTxAlgoTransferFromAccount(runtime, alice, alice, bob, DEFAULT_AMOUNT, { totalFee: FEE }),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(alice.getSpendAddress(), alice.address)
      );
    });

    it("Can rekey account again", () => {
      rekeyFromAccount(runtime, bob, alice, lsigAccount);
      // check spend address
      assert.equal(alice.getSpendAddress(), lsigAccount.address);
    });

    it("Can Rekey again back to orginal account", () => {
      rekeyFromAccount(runtime, bob, alice, alice);
      // check spend address
      assert.equal(alice.getSpendAddress(), alice.address);
    });

    it("close account should remove spend/auth address", () => {
      const aliceBalanceBefore = alice.balance();
      const bobBalanceBefore = bob.balance();

      closeWithAccount(runtime, bob, alice, bob);
      // check account state after clsoe
      assert.equal(alice.balance(), 0n);
      assert.equal(bob.balance(), aliceBalanceBefore + bobBalanceBefore - BigInt(FEE));
      assert.equal(alice.getSpendAddress(), alice.address);
    });
  });

  describe("Account to Lsig", function () {
    this.beforeEach(() => {
      // create rekey transaction
      rekeyFromAccount(runtime, alice, alice, lsigAccount);
    });

    it("spend address of alice account should be lsig address", () => {
      assert.isNotNull(alice.account.spend);
      assert.equal(alice.getSpendAddress(), lsigAccount.address);
    });

    it("Transfer ALGO by valid spend account", () => {
      verifyTransferAlgoAuthByLsig(runtime, lsig, alice, bob, DEFAULT_AMOUNT);
    });

    it("Should failed because cloneLsig is invalid spend address of alice account", () => {
      expectRuntimeError(
        () => mkTxAlgoTransferFromLsig(runtime, cloneLsig, alice, bob, DEFAULT_AMOUNT, { totalFee: FEE }),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(alice.getSpendAddress(), cloneLsigAccount.address)
      );
    });

    it("Should failed: when use another account", () => {
      expectRuntimeError(
        () => mkTxAlgoTransferFromAccount(runtime, john, alice, bob, DEFAULT_AMOUNT, { totalFee: FEE }),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(alice.getSpendAddress(), john.address)
      );
    });

    it("close account should remove spend/auth address", () => {
      const aliceBalanceBefore = alice.balance();
      const bobBalanceBefore = bob.balance();

      // close alice account to bob
      closeWithLsig(runtime, lsig, alice, bob);

      // check account state after close
      assert.equal(alice.balance(), 0n);
      assert.equal(bob.balance(), aliceBalanceBefore + bobBalanceBefore - BigInt(FEE));
      assert.equal(alice.getSpendAddress(), alice.address);
    });
  });

  describe("Lsig to Lsig", function () {
    this.beforeEach(() => {
      rekeyFromLsig(runtime, lsig, lsigAccount, cloneLsigAccount);
    });

    it("Spend address of lsig should be cloneLsig address", () => {
      assert.isNotNull(lsigAccount.account.spend);
      assert.equal(lsigAccount.getSpendAddress(), cloneLsigAccount.address);
    });

    it("Transfer ALGO by valid spend account", () => {
      verifyTransferAlgoAuthByLsig(runtime, cloneLsig, lsigAccount, alice, DEFAULT_AMOUNT);
    });

    it("Should failed if signer is invalid spend account", () => {
      expectRuntimeError(
        () => mkTxAlgoTransferFromLsig(runtime, lsig, lsigAccount, alice, DEFAULT_AMOUNT, { totalFee: FEE }),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(lsigAccount.getSpendAddress(), lsigAccount.address)
      );
    });

    it("close account should remove spend/auth address", () => {
      const lsigAccountBalanceBefore = lsigAccount.balance();
      const aliceBalanceBefore = alice.balance();

      // close lsig account to alice
      closeWithLsig(runtime, cloneLsig, lsigAccount, alice);
      // check account state after close
      assert.equal(lsigAccount.balance(), 0n);
      assert.equal(alice.balance(), lsigAccountBalanceBefore + aliceBalanceBefore - BigInt(FEE));
      assert.equal(lsigAccount.getSpendAddress(), lsigAccount.address);
    });
  });

  describe("Lsig to account", function () {
    this.beforeEach(() => {
      // create rekey transaction
      rekeyFromLsig(runtime, lsig, lsigAccount, bob);
    });

    it("Spend address of lsig should change to bob", () => {
      assert.isNotNull(lsigAccount.account.spend);
      assert.equal(lsigAccount.getSpendAddress(), bob.address);
    });

    it("Transfer ALGO by spend account", () => {
      verifyTransferAlgoAuthByAccount(runtime, bob, lsigAccount, alice, DEFAULT_AMOUNT);
    });

    it("Should failed if alice is invalid spend address of lsig address", () => {
      expectRuntimeError(
        () => mkTxAlgoTransferFromAccount(
          runtime, alice, lsigAccount, alice, DEFAULT_AMOUNT, { totalFee: FEE }
        ),
        RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
        rekeyMessageError(lsigAccount.getSpendAddress(), alice.address)
      );

      assert.equal(lsigAccount.getSpendAddress(), bob.address);
    });

    it("close account should remove auth/spend address", () => {
      // balance before close
      const lsigBalanceBefore = lsigAccount.balance();
      const aliceBalanceBefore = alice.balance();

      closeWithAccount(runtime, bob, lsigAccount, alice);
      // check account state after close
      syncAccounts();
      assert.equal(lsigAccount.balance(), 0n);
      assert.equal(alice.balance(), lsigBalanceBefore + aliceBalanceBefore - BigInt(FEE));
      assert.equal(lsigAccount.getSpendAddress(), lsigAccount.address);
    });
  });

  describe("Rekey by another Tx type", function () {
    this.beforeEach(() => {
      const ASAReceipt = runtime.deployASADef("gold",
        {
          total: 100000n,
          decimals: 0
        },
        {
          creator: { name: "alice", ...alice.account }
        });

      // rekey account
      txParams = {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: alice.address,
        assetID: ASAReceipt.assetID,
        amount: 0n,
        payFlags: {
          totalFee: 1000,
          rekeyTo: bob.address
        }
      };
      runtime.executeTx(txParams);
      syncAccounts();
    });

    it("Check spend address", () => {
      assert.equal(alice.getSpendAddress(), bob.address);
    });
  });
});
