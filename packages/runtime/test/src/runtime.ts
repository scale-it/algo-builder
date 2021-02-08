import { AssetHolding, LogicSig } from "algosdk";
import { assert } from "chai";
import sinon from "sinon";

import { StoreAccount } from "../../src/account";
import { ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/runtime";
import type { AlgoTransferParam, AssetTransferParam, ExecParams } from "../../src/types";
import { SignType, TransactionType } from "../../src/types";
import { expectTealError } from "../helpers/errors";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

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
    expectTealError(
      () => runtime.executeTx(txnParam),
      ERRORS.TEAL.LOGIC_SIGNATURE_VALIDATION_FAILED
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
    expectTealError(
      () => runtime.executeTx(txnParam),
      ERRORS.TEAL.REJECTED_BY_LOGIC
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
    runtime.setRound(20);

    runtime.executeTx(txnParams);

    // get final state (updated accounts)
    syncAccounts();
    assert.equal(john.balance(), minBalance - 1100);
    assert.equal(bob.balance(), minBalance + 100);
  });

  it("should fail if current round is not between first and last valid", () => {
    runtime.setRound(3);

    expectTealError(
      () => runtime.executeTx(txnParams),
      ERRORS.TEAL.INVALID_ROUND
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
  let alice = new StoreAccount(minBalance);
  let runtime: Runtime;
  let assetTransferParam: AssetTransferParam;
  this.beforeAll(() => {
    runtime = new Runtime([john, alice]);

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

  const syncAccounts = (): void => {
    john = runtime.getAccount(john.address);
    alice = runtime.getAccount(alice.address);
  };

  it("should create asset using asa.yaml file", () => {
    const assetId = runtime.createAsset('gold',
      { creator: { ...john.account, name: "john" } });

    const res = runtime.getAssetDef(assetId);
    assert.equal(res.decimals, 0);
    assert.equal(res["default-frozen"], false);
    assert.equal(res.total, 5912599999515);
    assert.equal(res["unit-name"], "GLD");
    assert.equal(res.url, "url");
    assert.equal(res["metadata-hash"], "12312442142141241244444411111133");
    assert.equal(res.manager, "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE");
    assert.equal(res.reserve, "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE");
    assert.equal(res.freeze, "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE");
    assert.equal(res.clawback, "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE");
  });

  it("should opt-in to asset for john", () => {
    const assetId = runtime.createAsset('gold',
      { creator: { ...john.account, name: "john" } });

    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);

    // opt-in for john (creator)
    runtime.optIntoASA(assetId, john.address, {});
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
    const errMsg = 'TEAL_ERR902: Asset with Index 1234 not found';
    assert.throws(() => runtime.optIntoASA(1234, john.address, {}), errMsg);
  });

  it("should warn if account already is already opted-into asset", () => {
    const spy = sinon.spy(console, 'warn');
    const assetId = runtime.createAsset('gold',
      { creator: { ...john.account, name: "john" } });

    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);
    runtime.optIntoASA(assetId, john.address, {});

    // executing same opt-in tx again
    const warnMsg = `${john.address} is already opted in to asset ${assetId}`;
    runtime.optIntoASA(assetId, john.address, {});
    assert(spy.calledWith(warnMsg));
    spy.restore();
  });

  it("should transfer asset between two accounts", () => {
    const assetId = runtime.createAsset('gold',
      { creator: { ...john.account, name: "john" } });

    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);
    runtime.optIntoASA(assetId, john.address, {});
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
    const assetId = runtime.createAsset('gold',
      { creator: { ...john.account, name: "john" } });

    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);
    runtime.optIntoASA(assetId, john.address, {});
    runtime.optIntoASA(assetId, alice.address, {});

    // freezing asset holding for john
    const johnHolding = john.getAssetHolding(assetId) as AssetHolding;
    johnHolding["is-frozen"] = true;

    assetTransferParam.assetID = assetId;
    const errMsg = `TEAL_ERR904: Asset index ${assetId} frozen for account ${john.address}`;
    assert.throws(() => runtime.executeTx(assetTransferParam), errMsg);
  });

  it("should close john account for transfer asset if close remainder to is specified", () => {
    const assetId = runtime.createAsset('gold',
      { creator: { ...john.account, name: "john" } });

    const res = runtime.getAssetDef(assetId);
    assert.isDefined(res);
    runtime.optIntoASA(assetId, john.address, {});
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
});
