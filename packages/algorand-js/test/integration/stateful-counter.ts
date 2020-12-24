import { ExecParams, SignType, TransactionType } from "algob/src/types";
import { assert } from "chai";

import { Runtime } from "../../src/index";
import { toBytes } from "../../src/lib/parsing";
import { StoreAccountImpl } from "../../src/runtime/account";
import { getAcc } from "../helpers/account";

describe("Algorand Smart Contracts - Stateful Counter example", function () {
  const john = new StoreAccountImpl(1000);

  const txnParams: ExecParams = {
    type: TransactionType.CallNoOpSSC,
    sign: SignType.LogicSignature,
    fromAccount: john.account,
    appId: 0,
    payFlags: { totalFee: 1000 }
  };

  let runtime: Runtime;
  this.beforeAll(function () {
    runtime = new Runtime([john]); // setup test

    // create new app
    txnParams.appId = runtime.createApp({
      sender: john.account,
      globalBytes: 32,
      globalInts: 32,
      localBytes: 8,
      localInts: 8
    });
    // opt-in to app
    runtime.optInToApp(txnParams.appId, john.address);
  });

  const key = "counter";
  it("should initialize global and local counter to 1 on first call", async function () {
    // execute transaction
    await runtime.executeTx(txnParams, 'counter-approval.teal', []);

    const globalCounter = runtime.getGlobalState(txnParams.appId, toBytes(key));
    assert.isDefined(globalCounter); // there should be a value present with key "counter"
    assert.equal(globalCounter, BigInt('1'));

    const localCounter = getAcc(runtime, john).getLocalState(txnParams.appId, toBytes(key)); // get local value from john account
    assert.isDefined(localCounter); // there should be a value present in local state with key "counter"
    assert.equal(localCounter, BigInt('1'));
  });

  it("should update counter by +1 for both global and local states on second call", async function () {
    const globalCounter = runtime.getGlobalState(txnParams.appId, toBytes(key)) as bigint;
    const localCounter = getAcc(runtime, john).getLocalState(txnParams.appId, toBytes(key)) as bigint;

    // verfify that both counters are set to 1 (by the previous test)
    assert.equal(globalCounter, BigInt('1'));
    assert.equal(localCounter, BigInt('1'));

    // execute transaction
    await runtime.executeTx(txnParams, 'counter-approval.teal', []);

    // after execution the counters should be updated by +1
    const newGlobalCounter = runtime.getGlobalState(txnParams.appId, toBytes(key));
    const newLocalCounter = getAcc(runtime, john).getLocalState(txnParams.appId, toBytes(key));

    assert.equal(newGlobalCounter, globalCounter + BigInt('1'));
    assert.equal(newLocalCounter, localCounter + BigInt('1'));
  });
});
