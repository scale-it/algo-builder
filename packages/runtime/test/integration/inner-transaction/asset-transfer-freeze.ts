import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore, Runtime } from "../../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../../src/lib/constants";
import { AccountStoreI, AppDeploymentFlags } from "../../../src/types";
import { getProgram } from "../../helpers/files";
import { useFixture } from "../../helpers/integration";

describe("Algorand Smart Contracts(TEALv5) - Inner Transactions[Asset Transfer, Asset Freeze]", function () {
  useFixture("inner-transaction");
  const fee = 1000;
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 50 + fee;
  const master = new AccountStore(300e6);
  let john = new AccountStore(minBalance + fee);
  let elon = new AccountStore(minBalance + fee);
  let bob = new AccountStore(minBalance + fee);
  let appAccount: AccountStoreI; // initialized later

  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let appCreationFlags: AppDeploymentFlags;
  let appID: number;
  let assetID: number;
  let appCallParams: types.ExecParams;
  this.beforeAll(function () {
    runtime = new Runtime([master, john, elon, bob]); // setup test
    approvalProgram = getProgram('approval-asset-transfer.teal');
    clearProgram = getProgram('clear.teal');

    appCreationFlags = {
      sender: john.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };
  });

  this.beforeEach(() => {
    // create app
    appID = runtime.addApp(appCreationFlags, {}, approvalProgram, clearProgram);
    appAccount = runtime.getAccount(getApplicationAddress(appID)); // update app account

    // create asset
    assetID = runtime.addAsset('gold',
      { creator: { ...john.account, name: "john" } });

    // fund app (escrow belonging to app) with 10 ALGO
    const fundAppParams: types.AlgoTransferParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: getApplicationAddress(appID),
      amountMicroAlgos: 10e6,
      payFlags: { totalFee: 1000 }
    };

    runtime.executeTx(fundAppParams);
    syncAccounts();

    appCallParams = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: john.account,
      appID: appID,
      payFlags: { totalFee: 1000 }
    };
  });

  function syncAccounts (): void {
    appAccount = runtime.getAccount(getApplicationAddress(appID));
    john = runtime.getAccount(john.address);
    elon = runtime.getAccount(elon.address);
    bob = runtime.getAccount(bob.address);
  };

  function optInToASAbyApp (): void {
    const optInParams = {
      ...appCallParams,
      appArgs: ['str:opt_in_to_asa'],
      foreignAssets: [assetID]
    };
    runtime.executeTx(optInParams);
    syncAccounts();

    // transfer some ASA to app
    const asaTransferParam: types.ExecParams = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: john.account,
      toAccountAddr: appAccount.address,
      amount: 10,
      assetID: assetID,
      payFlags: { totalFee: 1000 }
    };
    runtime.executeTx(asaTransferParam);
    syncAccounts();

    runtime.optIntoASA(assetID, elon.address, {});
    syncAccounts();
  }

  it("should optin to ASA (by app account)", function () {
    const appHoldingBefore = appAccount.getAssetHolding(assetID);
    assert.isUndefined(appHoldingBefore);

    // optin by app to assetID
    optInToASAbyApp();

    // verify optin
    assert.isDefined(appAccount.getAssetHolding(assetID));
  });

  it("fail on ASA transfer by App if app not optedin to ASA", function () {
    // contracts sends 1 ASA to sender, and 2 ASA to txn.accounts[1]
    const transferASAbyAppParam = {
      ...appCallParams,
      appArgs: ['str:transfer_asa'],
      accounts: [elon.address],
      foreignAssets: [assetID]
    };
    assert.throws(
      () => runtime.executeTx(transferASAbyAppParam),
      `RUNTIME_ERR1404: Account ${appAccount.address} doesn't hold asset index 2`
    );
  });

  it("initiate ASA transfer from smart contract", function () {
    optInToASAbyApp();
    const appHoldingBefore = appAccount.getAssetHolding(assetID)?.amount as bigint;
    const johnHoldingBefore = john.getAssetHolding(assetID)?.amount as bigint;
    const elonHoldingBefore = elon.getAssetHolding(assetID)?.amount as bigint;

    // contracts sends 1 ASA to sender, and 2 ASA to txn.accounts[1]
    const transferASAbyAppParam = {
      ...appCallParams,
      appArgs: ['str:transfer_asa'],
      accounts: [elon.address],
      foreignAssets: [assetID]
    };
    runtime.executeTx(transferASAbyAppParam);
    syncAccounts();

    // verify ASA transfer
    assert.equal(appAccount.getAssetHolding(assetID)?.amount, appHoldingBefore - 3n);
    assert.equal(john.getAssetHolding(assetID)?.amount, johnHoldingBefore + 1n);
    assert.equal(elon.getAssetHolding(assetID)?.amount, elonHoldingBefore + 2n);
  });

  it("empty app's account ASA holding to txn.accounts[1] if close remainder to is passed", function () {
    optInToASAbyApp();
    const appHoldingBefore = appAccount.getAssetHolding(assetID)?.amount as bigint;
    const elonHoldingBefore = elon.getAssetHolding(assetID)?.amount as bigint;
    assert.isDefined(appHoldingBefore);

    // empties contract's ALGO's to elon (after deducting fees)
    const txParams = {
      ...appCallParams,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:transfer_asa_with_close_rem_to'],
      accounts: [elon.address],
      foreignAssets: [assetID]
    };
    runtime.executeTx(txParams);
    syncAccounts();

    // verify app holding removed and all ASA transferred to elon
    assert.isUndefined(appAccount.getAssetHolding(assetID));
    assert.equal(elon.getAssetHolding(assetID)?.amount, elonHoldingBefore + appHoldingBefore);
  });

  it("should fail on asset clawback if clawback !== application account", function () {
    optInToASAbyApp();
    // empties contract's ALGO's to elon (after deducting fees)
    const txParams = {
      ...appCallParams,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:asa_clawback_from_txn1_to_txn2'],
      accounts: [john.address, elon.address], // clawback 2 ASA from john -> elon by App
      foreignAssets: [assetID]
    };
    assert.throws(
      () => runtime.executeTx(txParams),
      `RUNTIME_ERR1506: Only Clawback account WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY can revoke asset`
    );
  });

  it("should clawback 2 ASA by application account from Txn.accounts[1] to Txn.accounts[2]", function () {
    optInToASAbyApp();
    const johnHoldingBefore = john.getAssetHolding(assetID)?.amount as bigint;
    const elonHoldingBefore = elon.getAssetHolding(assetID)?.amount as bigint;

    // update clawback to app account
    const asaDef = john.createdAssets.get(assetID);
    if (asaDef) asaDef.clawback = appAccount.address;

    // empties contract's ALGO's to elon (after deducting fees)
    const txParams = {
      ...appCallParams,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:asa_clawback_from_txn1_to_txn2'],
      accounts: [john.address, elon.address], // clawback 2 ASA from john -> elon by App
      foreignAssets: [assetID]
    };

    runtime.executeTx(txParams);
    syncAccounts();

    // verify 2 ASA are clawbacked from john -> elon
    assert.equal(john.getAssetHolding(assetID)?.amount, johnHoldingBefore - 2n);
    assert.equal(elon.getAssetHolding(assetID)?.amount, elonHoldingBefore + 2n);
  });
});
