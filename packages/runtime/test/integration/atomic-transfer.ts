import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../build/errors/errors-list";
import { Runtime, StoreAccount } from "../../src/index";
import { ExecParams, SignType, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { elonMuskAccount } from "../mocks/account";

describe("Algorand Smart Contracts - Atomic Transfers", function () {
  useFixture("stateful");
  const initialBalance = 5e6;
  let john: StoreAccount;
  let alice: StoreAccount;
  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let assetId: number;
  let appId: number;

  this.beforeEach(() => {
    john = new StoreAccount(initialBalance, elonMuskAccount);
    alice = new StoreAccount(initialBalance);
    runtime = new Runtime([john, alice]); // setup test
    // create asset
    assetId = runtime.addAsset('gold',
      { creator: { ...john.account, name: "john" } });
    approvalProgram = getProgram('counter-approval.teal');

    // create new app
    appId = runtime.addApp({
      sender: john.account,
      globalBytes: 32,
      globalInts: 32,
      localBytes: 8,
      localInts: 8
    }, {}, approvalProgram, clearProgram);
    // opt-in to app
    runtime.optInToApp(john.address, appId, {}, {});
    // opt-in for alice
    runtime.optIntoASA(assetId, alice.address, {});
    syncAccounts();
  });

  function syncAccounts (): void {
    john = runtime.getAccount(john.address);
    alice = runtime.getAccount(alice.address);
  }

  const key = "counter";

  it("should execute payment and asset transaction", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 100,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        toAccountAddr: alice.account.addr,
        amount: 10,
        assetID: 1,
        payFlags: { totalFee: 1000 }
      }
    ];
    const initialJohnAssets = john.getAssetHolding(assetId)?.amount as number;
    const initialAliceAssets = alice.getAssetHolding(assetId)?.amount as number;
    assert.isDefined(initialJohnAssets);
    assert.isDefined(initialAliceAssets);

    runtime.executeTx(txGroup);

    syncAccounts();
    assert.equal(john.getAssetHolding(assetId)?.amount, initialJohnAssets - 10);
    assert.equal(alice.getAssetHolding(assetId)?.amount, initialAliceAssets + 10);
    assert.equal(john.balance(), initialBalance - 2100);
    assert.equal(alice.balance(), initialBalance + 100);
  });

  it("should not execute payment transaction if asset transaction fails", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 100,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.account.addr,
        amount: 1000,
        assetID: 1,
        payFlags: { totalFee: 1000 }
      }
    ];
    const initialJohnAssets = john.getAssetHolding(assetId)?.amount as number;
    const initialAliceAssets = alice.getAssetHolding(assetId)?.amount as number;
    assert.isDefined(initialJohnAssets);
    assert.isDefined(initialAliceAssets);

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS
    );

    syncAccounts();
    assert.equal(john.getAssetHolding(assetId)?.amount, initialJohnAssets);
    assert.equal(alice.getAssetHolding(assetId)?.amount, initialAliceAssets);
    assert.equal(john.balance(), initialBalance);
    assert.equal(alice.balance(), initialBalance);
  });

  it("should execute payment and ssc call", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        appId: appId,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 100,
        payFlags: { totalFee: 1000 }
      }
    ];
    runtime.executeTx(txGroup);

    const globalCounter = runtime.getGlobalState(appId, key);
    assert.isDefined(globalCounter); // there should be a value present with key "counter"
    assert.equal(globalCounter, 1n);

    const localCounter = runtime.getAccount(john.address).getLocalState(appId, key); // get local value from john account
    assert.isDefined(localCounter); // there should be a value present in local state with key "counter"
    assert.equal(localCounter, 1n);

    syncAccounts();
    assert.equal(john.balance(), initialBalance - 2100);
    assert.equal(alice.balance(), initialBalance + 100);
  });

  it("should fail if payment transaction fails", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        appId: appId,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 6e6,
        payFlags: { totalFee: 1000 }
      }
    ];
    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    const localCounter = runtime.getAccount(john.address).getLocalState(appId, key);
    assert.isDefined(localCounter);
    assert.equal(localCounter, 0n);

    syncAccounts();
    assert.equal(john.balance(), initialBalance);
    assert.equal(alice.balance(), initialBalance);
  });

  it("should not freeze asset if payment fails", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.FreezeAsset,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        assetID: assetId,
        freezeTarget: alice.address,
        freezeState: true,
        payFlags: {}
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 6e6,
        payFlags: { totalFee: 1000 }
      }
    ];

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    syncAccounts();
    assert.equal(alice.getAssetHolding(assetId)?.["is-frozen"], false);
  });

  it("should not modify asset if payment fails", () => {
    const modFields = {
      manager: john.address,
      reserve: john.address,
      clawback: john.address,
      freeze: john.address
    };
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.ModifyAsset,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        assetID: assetId,
        fields: modFields,
        payFlags: {}
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 6e6,
        payFlags: { totalFee: 1000 }
      }
    ];

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    // Verify asset manager is not changed
    assert.equal(runtime.getAssetDef(assetId).manager, "WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY");
  });

  it("should not revoke asset if payment fails", () => {
    // transfer asset to alice
    runtime.executeTx({
      type: TransactionType.TransferAsset,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      toAccountAddr: alice.account.addr,
      amount: 20,
      assetID: 1,
      payFlags: { totalFee: 1000 }
    });
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.RevokeAsset,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        recipient: john.address,
        assetID: assetId,
        revocationTarget: alice.address,
        amount: 15,
        payFlags: {}
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 6e6,
        payFlags: { totalFee: 1000 }
      }
    ];
    syncAccounts();
    const initialAliceAssets = alice.getAssetHolding(assetId)?.amount as number;

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    syncAccounts();
    assert.equal(alice.getAssetHolding(assetId)?.amount, initialAliceAssets);
  });

  it("should not destroy asset if payment fails", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.DestroyAsset,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        assetID: assetId,
        payFlags: {}
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 6e6,
        payFlags: { totalFee: 1000 }
      }
    ];

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    assert.equal(runtime.getAssetDef(assetId).creator, john.address);
  });

  it("should fail close app if payment transaction fails", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.CloseSSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        appId: appId,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 6e6,
        payFlags: { totalFee: 1000 }
      }
    ];

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    syncAccounts();
    assert.isDefined(john.getLocalState(appId, key));
  });

  it("should fail clear app if payment transaction fails", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.ClearSSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        appId: appId,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 6e6,
        payFlags: { totalFee: 1000 }
      }
    ];

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    syncAccounts();
    assert.isDefined(john.getLocalState(appId, key));
  });

  it("should fail asset payment, and algo payment if ssc call fails", () => {
    // close out from app
    runtime.executeTx({
      type: TransactionType.ClearSSC,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      appId: appId,
      payFlags: { totalFee: 1000 }
    });
    syncAccounts();
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.ClearSSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        appId: appId,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        toAccountAddr: john.address,
        amountMicroAlgos: 100,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        toAccountAddr: alice.account.addr,
        amount: 10,
        assetID: 1,
        payFlags: { totalFee: 1000 }
      }
    ];
    const initialJohnAssets = john.getAssetHolding(assetId)?.amount as number;
    const initialAliceAssets = alice.getAssetHolding(assetId)?.amount as number;
    const initialJohnBalance = john.balance();

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
    );

    syncAccounts();
    assert.equal(john.balance(), initialJohnBalance);
    assert.equal(alice.balance(), initialBalance);
    assert.equal(john.getAssetHolding(assetId)?.amount, initialJohnAssets);
    assert.equal(alice.getAssetHolding(assetId)?.amount, initialAliceAssets);
  });
});
