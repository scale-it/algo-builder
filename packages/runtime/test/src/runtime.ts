import { LogicSig } from "algosdk";
import { assert } from "chai";

import { StoreAccount } from "../../src/account";
import { ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/runtime";
import type { AlgoTransferParam, ExecParams } from "../../src/types";
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

describe("Asset Creation", function () {
  useFixture('asa-check');
  const john = new StoreAccount(minBalance);
  let runtime: Runtime;
  this.beforeAll(() => {
    runtime = new Runtime([john]);
  });

  it("should create asset using asa.yaml file", () => {
    const assetId = runtime.createAsset('gold',
      { creator: { name: "john", addr: john.address, sk: john.account.sk } });

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
});
