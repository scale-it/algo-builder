import { LogicSig } from "algosdk";
import { assert } from "chai";
import sinon from "sinon";

import { StoreAccount } from "../../src/account";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/runtime";
import type { AlgoTransferParam, AssetModFields, AssetTransferParam, DestroyAssetParam, ExecParams, FreezeAssetParam, ModifyAssetParam, RevokeAssetParam } from "../../src/types";
import { SignType, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { elonMuskAccount } from "../mocks/account";

const programName = "basic.teal";
const minBalance = 1e7;

describe("Logic Signature Transaction in Runtime", function () {
  useFixture("basic-teal");
  const john = new StoreAccount(minBalance);
  const bob = new StoreAccount(minBalance);
  const alice = new StoreAccount(minBalance);

  let runtime: Runtime;
  let lsig: LogicSig;
  let txnParam: ExecParams;
  this.beforeAll(function () {
    runtime = new Runtime([john, bob, alice]);
    lsig = runtime.getLogicSig(getProgram(programName), []);
    txnParam = {
      type: TransactionType.TransferAlgo,
      sign: SignType.LogicSignature,
      fromAccount: john.account,
      toAccountAddr: bob.account.addr,
      amountMicroAlgos: 1000,
      lsig: lsig,
      payFlags: { totalFee: 1000 }
    };
  });

  it("should execute the lsig and verify john(delegated signature)", () => {
    lsig.sign(john.account.sk);
    runtime.executeTx(txnParam);

    // balance should be updated because logic is verified and accepted
    const bobAcc = runtime.getAccount(bob.address);
    assert.equal(bobAcc.balance(), minBalance + 1000);
  });

  it("should not verify signature because alice sent it", () => {
    txnParam.fromAccount = alice.account;

    // execute transaction (logic signature validation failed)
    expectRuntimeError(
      () => runtime.executeTx(txnParam),
      RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_VALIDATION_FAILED
    );
  });

  it("should verify signature but reject logic", async () => {
    const logicSig = runtime.getLogicSig(getProgram("reject.teal"), []);
    txnParam.lsig = logicSig;
    txnParam.fromAccount = john.account;

    logicSig.sign(john.account.sk);
    // execute transaction (rejected by logic)
    // - Signature successfully validated for john
    // - But teal file logic is rejected
    expectRuntimeError(
      () => runtime.executeTx(txnParam),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });
});

describe("Rounds Test", function () {
  useFixture("basic-teal");
  let john = new StoreAccount(minBalance);
  let bob = new StoreAccount(minBalance);
  let runtime: Runtime;
  let txnParams: AlgoTransferParam;
  this.beforeAll(function () {
    runtime = new Runtime([john, bob]); // setup test

    // set up transaction paramenters
    txnParams = {
      type: TransactionType.TransferAlgo, // payment
      sign: SignType.SecretKey,
      fromAccount: john.account,
      toAccountAddr: bob.address,
      amountMicroAlgos: 100,
      payFlags: { firstValid: 5, validRounds: 200 }
    };
  });

  afterEach(function () {
    john = new StoreAccount(minBalance);
    bob = new StoreAccount(minBalance);
    runtime = new Runtime([john, bob]);
    txnParams.fromAccount = john.account;
    txnParams.toAccountAddr = bob.address;
  });

  function syncAccounts (): void {
    john = runtime.getAccount(john.address);
    bob = runtime.getAccount(bob.address);
  }

  it("should succeed if current round is between first and last valid", () => {
    txnParams.payFlags = { totalFee: 1000, firstValid: 5, validRounds: 200 };
    runtime.setRoundAndTimestamp(20, 20);

    runtime.executeTx(txnParams);

    // get final state (updated accounts)
    syncAccounts();
    assert.equal(john.balance(), minBalance - 1100);
    assert.equal(bob.balance(), minBalance + 100);
  });

  it("should fail if current round is not between first and last valid", () => {
    runtime.setRoundAndTimestamp(3, 20);

    expectRuntimeError(
      () => runtime.executeTx(txnParams),
      RUNTIME_ERRORS.GENERAL.INVALID_ROUND
    );
  });

  it("should succeeded by default (no round requirement is passed)", () => {
    txnParams.payFlags = { totalFee: 1000 };

    runtime.executeTx(txnParams);

    // get final state (updated accounts)
    syncAccounts();
    assert.equal(john.balance(), minBalance - 1100);
    assert.equal(bob.balance(), minBalance + 100);
  });
});

describe("Algorand Standard Assets", function () {
  useFixture('asa-check');
  let john = new StoreAccount(minBalance);
  const bob = new StoreAccount(minBalance);
  let alice = new StoreAccount(minBalance);
  const elon = new StoreAccount(minBalance, elonMuskAccount);
  let runtime: Runtime;
  let modFields: AssetModFields;
  let assetTransferParam: AssetTransferParam;
  let assetId: number;
  this.beforeAll(() => {
    runtime = new Runtime([john, bob, alice, elon]);
    modFields = {
      manager: bob.address,
      reserve: bob.address,
      clawback: john.address,
      freeze: john.address
    };
    assetTransferParam = {
      type: TransactionType.TransferAsset,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      toAccountAddr: alice.account.addr,
      amount: 10,
      assetID: 1,
      payFlags: { totalFee: 1000 }
    };
  });

  this.beforeEach(() => {
    assetId = runtime.createAsset('gold',
      { creator: { ...john.account, name: "john" } });
  });

  const syncAccounts = (): void => {
    john = runtime.getAccount(john.address);
    alice = runtime.getAccount(alice.address);
  };

  it("should create asset using asa.yaml file", () => {
    const res = runtime.getAssetDef(assetId);
    assert.equal(res.decimals, 0);
    assert.equal(res["default-frozen"], false);
    assert.equal(res.total, 5912599999515);
    assert.equal(res["unit-name"], "GLD");
    assert.equal(res.url, "url");
    assert.equal(res["metadata-hash"], "12312442142141241244444411111133");
    assert.equal(res.manager, elon.address);
    assert.equal(res.reserve, elon.address);
    assert.equal(res.freeze, elon.address);
    assert.equal(res.clawback, elon.address);
  });

  it("should opt-in to asset", () => {
    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);

    const johnAssetHolding = john.getAssetHolding(assetId);
    assert.isDefined(johnAssetHolding);
    assert.equal(johnAssetHolding?.amount as number, 5912599999515);

    // opt-in for alice
    runtime.optIntoASA(assetId, alice.address, {});
    const aliceAssetHolding = alice.getAssetHolding(assetId);
    assert.isDefined(aliceAssetHolding);
    assert.equal(aliceAssetHolding?.amount as number, 0);
  });

  it("should throw error on opt-in of asset does not exist", () => {
    expectRuntimeError(
      () => runtime.optIntoASA(1234, john.address, {}),
      RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND
    );
  });

  it("should warn if account already is already opted-into asset", () => {
    const spy = sinon.spy(console, 'warn');
    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);

    // executing same opt-in tx again
    const warnMsg = `${john.address} is already opted in to asset ${assetId}`;
    runtime.optIntoASA(assetId, john.address, {});
    assert(spy.calledWith(warnMsg));
    spy.restore();
  });

  it("should transfer asset between two accounts", () => {
    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);
    runtime.optIntoASA(assetId, alice.address, {});

    const initialJohnAssets = john.getAssetHolding(assetId)?.amount as number;
    const initialAliceAssets = alice.getAssetHolding(assetId)?.amount as number;
    assert.isDefined(initialJohnAssets);
    assert.isDefined(initialAliceAssets);

    assetTransferParam.assetID = assetId;
    assetTransferParam.amount = 100;
    runtime.executeTx(assetTransferParam);
    syncAccounts();

    assert.equal(john.getAssetHolding(assetId)?.amount, initialJohnAssets - 100);
    assert.equal(alice.getAssetHolding(assetId)?.amount, initialAliceAssets + 100);
  });

  it("should throw error on transfer asset if asset is frozen", () => {
    const freezeParam: FreezeAssetParam = {
      type: TransactionType.FreezeAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      assetID: assetId,
      freezeTarget: john.address,
      freezeState: true,
      payFlags: {}
    };

    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);
    runtime.optIntoASA(assetId, alice.address, {});
    // freezing asset holding for john
    runtime.executeTx(freezeParam);

    assetTransferParam.assetID = assetId;
    expectRuntimeError(
      () => runtime.executeTx(assetTransferParam),
      RUNTIME_ERRORS.TRANSACTION.ACCOUNT_ASSET_FROZEN
    );
  });

  it("should close john account for transfer asset if close remainder to is specified", () => {
    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);
    runtime.optIntoASA(assetId, alice.address, {});

    syncAccounts();
    const initialJohnAssets = john.getAssetHolding(assetId)?.amount as number;
    const initialAliceAssets = alice.getAssetHolding(assetId)?.amount as number;
    assert.isDefined(initialJohnAssets);
    assert.isDefined(initialAliceAssets);

    assetTransferParam.assetID = assetId;
    assetTransferParam.amount = 0;
    assetTransferParam.payFlags = { totalFee: 1000, closeRemainderTo: alice.address };
    runtime.executeTx(assetTransferParam); // transfer all assets of john => alice (using closeRemTo)
    syncAccounts();

    assert.equal(john.getAssetHolding(assetId)?.amount, 0);
    assert.equal(alice.getAssetHolding(assetId)?.amount, initialAliceAssets + initialJohnAssets);
  });

  it("should throw error if asset is not found while modifying", () => {
    const modifyParam: ModifyAssetParam = {
      type: TransactionType.ModifyAsset,
      sign: SignType.SecretKey,
      fromAccount: john.account,
      assetID: 120,
      fields: modFields,
      payFlags: {}
    };
    expectRuntimeError(
      () => runtime.executeTx(modifyParam),
      RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND
    );
  });

  it("should modify asset", () => {
    const modifyParam: ModifyAssetParam = {
      type: TransactionType.ModifyAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      assetID: assetId,
      fields: modFields,
      payFlags: {}
    };
    runtime.executeTx(modifyParam);

    const res = runtime.getAssetDef(assetId);
    assert.equal(res.manager, bob.address);
    assert.equal(res.reserve, bob.address);
    assert.equal(res.clawback, john.address);
    assert.equal(res.freeze, john.address);
  });

  it("Blank field test, should not modify asset because field is set to blank", () => {
    const assetId = runtime.createAsset('silver',
      { creator: { ...john.account, name: "john" } });

    const modFields: AssetModFields = {
      manager: bob.address,
      reserve: bob.address,
      clawback: john.address,
      freeze: alice.address
    };
    const modifyParam: ModifyAssetParam = {
      type: TransactionType.ModifyAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      assetID: assetId,
      fields: modFields,
      payFlags: {}
    };

    expectRuntimeError(
      () => runtime.executeTx(modifyParam),
      RUNTIME_ERRORS.ASA.BLANK_ADDRESS_ERROR
    );
  });

  it("should fail because only manager account can modify asset", () => {
    const modifyParam: ModifyAssetParam = {
      type: TransactionType.ModifyAsset,
      sign: SignType.SecretKey,
      fromAccount: bob.account,
      assetID: assetId,
      fields: modFields,
      payFlags: {}
    };
    expectRuntimeError(
      () => runtime.executeTx(modifyParam),
      RUNTIME_ERRORS.ASA.MANAGER_ERROR
    );
  });

  it("should fail because only freeze account can freeze asset", () => {
    const freezeParam: FreezeAssetParam = {
      type: TransactionType.FreezeAsset,
      sign: SignType.SecretKey,
      fromAccount: bob.account,
      assetID: assetId,
      freezeTarget: john.address,
      freezeState: true,
      payFlags: {}
    };

    expectRuntimeError(
      () => runtime.executeTx(freezeParam),
      RUNTIME_ERRORS.ASA.FREEZE_ERROR
    );
  });

  it("should freeze asset", () => {
    const freezeParam: FreezeAssetParam = {
      type: TransactionType.FreezeAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      assetID: assetId,
      freezeTarget: john.address,
      freezeState: true,
      payFlags: {}
    };
    runtime.executeTx(freezeParam);

    const johnAssetHolding = runtime.getAssetHolding(assetId, john.address);
    assert.equal(johnAssetHolding["is-frozen"], true);
  });

  it("should fail because only clawback account can revoke assets", () => {
    const revokeParam: RevokeAssetParam = {
      type: TransactionType.RevokeAsset,
      sign: SignType.SecretKey,
      fromAccount: alice.account,
      recipient: john.address,
      assetID: assetId,
      revocationTarget: bob.address,
      amount: 1,
      payFlags: {}
    };
    expectRuntimeError(
      () => runtime.executeTx(revokeParam),
      RUNTIME_ERRORS.ASA.CLAWBACK_ERROR
    );
  });

  it("should revoke assets", () => {
    const revokeParam: RevokeAssetParam = {
      type: TransactionType.RevokeAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      recipient: john.address,
      assetID: assetId,
      revocationTarget: bob.address,
      amount: 15,
      payFlags: {}
    };
    runtime.optIntoASA(assetId, bob.address, {});

    assetTransferParam.toAccountAddr = bob.address;
    assetTransferParam.amount = 20;
    assetTransferParam.assetID = assetId;
    assetTransferParam.payFlags = {};

    runtime.executeTx(assetTransferParam);

    let bobHolding = runtime.getAssetHolding(assetId, bob.address);
    const beforeRevokeJohn = runtime.getAssetHolding(assetId, john.address).amount;
    assert.equal(bobHolding.amount, assetTransferParam.amount);

    runtime.executeTx(revokeParam);

    const johnHolding = runtime.getAssetHolding(assetId, john.address);
    bobHolding = runtime.getAssetHolding(assetId, bob.address);
    assert.equal(beforeRevokeJohn + 15, johnHolding.amount);
    assert.equal(bobHolding.amount, 5);
  });

  it("should revoke if asset is frozen", () => {
    const freezeParam: FreezeAssetParam = {
      type: TransactionType.FreezeAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      assetID: assetId,
      freezeTarget: bob.address,
      freezeState: true,
      payFlags: {}
    };
    const revokeParam: RevokeAssetParam = {
      type: TransactionType.RevokeAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      recipient: john.address,
      assetID: assetId,
      revocationTarget: bob.address,
      amount: 15,
      payFlags: {}
    };
    runtime.optIntoASA(assetId, bob.address, {});

    assetTransferParam.toAccountAddr = bob.address;
    assetTransferParam.amount = 20;
    assetTransferParam.assetID = assetId;
    assetTransferParam.payFlags = {};
    runtime.executeTx(assetTransferParam);
    runtime.executeTx(freezeParam);
    let bobHolding = runtime.getAssetHolding(assetId, bob.address);
    const beforeRevokeJohn = runtime.getAssetHolding(assetId, john.address).amount;
    assert.equal(bobHolding.amount, assetTransferParam.amount);

    runtime.executeTx(revokeParam);

    const johnHolding = runtime.getAssetHolding(assetId, john.address);
    bobHolding = runtime.getAssetHolding(assetId, bob.address);
    assert.equal(beforeRevokeJohn + 15, johnHolding.amount);
    assert.equal(bobHolding.amount, 5);
  });

  it("Should fail because only manager can destroy assets", () => {
    const destroyParam: DestroyAssetParam = {
      type: TransactionType.DestroyAsset,
      sign: SignType.SecretKey,
      fromAccount: alice.account,
      assetID: assetId,
      payFlags: {}
    };
    expectRuntimeError(
      () => runtime.executeTx(destroyParam),
      RUNTIME_ERRORS.ASA.MANAGER_ERROR
    );
  });

  it("Should destroy asset", () => {
    const destroyParam: DestroyAssetParam = {
      type: TransactionType.DestroyAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      assetID: assetId,
      payFlags: {}
    };

    runtime.executeTx(destroyParam);

    expectRuntimeError(
      () => runtime.getAssetDef(assetId),
      RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND
    );
  });

  it("Should not destroy asset if total assets are not in creator's account", () => {
    const destroyParam: DestroyAssetParam = {
      type: TransactionType.DestroyAsset,
      sign: SignType.SecretKey,
      fromAccount: elon.account,
      assetID: assetId,
      payFlags: {}
    };
    runtime.optIntoASA(assetId, bob.address, {});

    assetTransferParam.toAccountAddr = bob.address;
    assetTransferParam.amount = 20;
    assetTransferParam.assetID = assetId;
    assetTransferParam.payFlags = {};
    runtime.executeTx(assetTransferParam);

    expectRuntimeError(
      () => runtime.executeTx(destroyParam),
      RUNTIME_ERRORS.ASA.ASSET_TOTAL_ERROR
    );
  });
});
