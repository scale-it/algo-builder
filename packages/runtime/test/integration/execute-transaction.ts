import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../build/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ExecParams, SignType, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { elonMuskAccount } from "../mocks/account";

describe("Algorand Smart Contracts - Execute transaction", function () {
  useFixture("stateful");
  const initialBalance = BigInt(5e6);
  let john: AccountStore;
  let alice: AccountStore;
  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let assetId: number;
  let appId: number;

  this.beforeEach(() => {
    john = new AccountStore(initialBalance, elonMuskAccount);
    alice = new AccountStore(initialBalance);
    runtime = new Runtime([john, alice]); // setup test
    approvalProgram = getProgram('counter-approval.teal');
    clearProgram = getProgram('clear.teal');
  });

  function syncAccounts (): void {
    john = runtime.getAccount(john.address);
    alice = runtime.getAccount(alice.address);
  }

  function setupAsset (): void {
    // create asset
    assetId = runtime.addAsset('gold',
      { creator: { ...john.account, name: "john" } });
  }

  function setupApp (): void {
    // create new app
    appId = runtime.addApp({
      sender: john.account,
      globalBytes: 32,
      globalInts: 32,
      localBytes: 8,
      localInts: 8
    }, {}, approvalProgram, clearProgram);
  }

  it("should execute group of (payment + asset creation) successfully", () => {
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
        type: TransactionType.DeployASA,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        asaName: 'gold',
        payFlags: { totalFee: 1000 }
      }
    ];
    runtime.executeTx(txGroup);

    syncAccounts();
    assert.equal(john.balance(), initialBalance - 2100n);
    assert.equal(alice.balance(), initialBalance + 100n);
  });

  it("should fail execution group (payment + asset creation), if asset def is not found", () => {
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
        type: TransactionType.DeployASA,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        asaName: 'doge',
        payFlags: { totalFee: 1000 }
      }
    ];
    const initialJohnAssets = john.getAssetHolding(assetId)?.amount as bigint;
    assert.isUndefined(initialJohnAssets);
    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR
    );

    // should not update algo balance
    syncAccounts();
    assert.equal(john.balance(), initialBalance);
    assert.equal(alice.balance(), initialBalance);
  });

  it("Should opt-in to asset, through execute transaction", () => {
    setupAsset();
    syncAccounts();
    const assetInfo = runtime.getAssetInfoFromName('gold');
    assert.isDefined(assetInfo);
    const tx: ExecParams[] = [
      {
        type: TransactionType.OptInASA,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        assetID: assetInfo?.assetIndex as number,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(tx);
  });

  it("should execute group of (payment + app creation) successfully", () => {
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
        type: TransactionType.DeploySSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        approvalProgram: approvalProgram,
        clearProgram: clearProgram,
        localInts: 1,
        localBytes: 1,
        globalInts: 1,
        globalBytes: 1,
        payFlags: { totalFee: 1000 }
      }
    ];
    runtime.executeTx(txGroup);

    syncAccounts();
    assert.equal(john.balance(), initialBalance - 2100n);
    assert.equal(alice.balance(), initialBalance + 100n);
  });

  it("should fail execution group (payment + asset creation), if not enough balance", () => {
    const txGroup: ExecParams[] = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        toAccountAddr: alice.address,
        amountMicroAlgos: 1e9,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.DeploySSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        approvalProgram: approvalProgram,
        clearProgram: clearProgram,
        localInts: 1,
        localBytes: 1,
        globalInts: 1,
        globalBytes: 1,
        payFlags: {}
      }
    ];

    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
    );

    // verify app doesn't exist in map
    const res = runtime.getAppInfoFromName(approvalProgram, clearProgram);
    assert.isUndefined(res);
  });

  it("Should opt-in to app, through execute transaction", () => {
    setupApp();
    syncAccounts();
    const appInfo = runtime.getAppInfoFromName(approvalProgram, clearProgram);
    assert.isDefined(appInfo);
    const tx: ExecParams[] = [
      {
        type: TransactionType.OptInSSC,
        sign: SignType.SecretKey,
        fromAccount: alice.account,
        appID: appInfo?.appID as number,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(tx);
  });
});
