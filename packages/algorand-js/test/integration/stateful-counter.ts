import { ExecParams, SignType, TransactionType } from "@algorand-builder/algob/src/types";
import { assert } from "chai";

import { Runtime, StoreAccountImpl } from "../../src/index";
import { BIGINT1 } from "../../src/interpreter/opcode-list";
import { stringToBytes } from "../../src/lib/parsing";
import { getAcc } from "../helpers/account";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - Stateful Counter example", function () {
  useFixture("stateful");
  const john = new StoreAccountImpl(1000);

  const txnParams: ExecParams = {
    type: TransactionType.CallNoOpSSC,
    sign: SignType.LogicSignature,
    fromAccount: john.account,
    appId: 0,
    payFlags: { totalFee: 1000 }
  };

  let runtime: Runtime;
  let program: string;
  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    program = getProgram('counter-approval.teal');

    // create new app
    txnParams.appId = await runtime.addApp({
      sender: john.account,
      globalBytes: 32,
      globalInts: 32,
      localBytes: 8,
      localInts: 8
    }, {}, program);

    // opt-in to app
    await runtime.optInToApp(john.address, txnParams.appId, {}, {}, program);
  });

  const key = "counter";
  it("should initialize global and local counter to 1 on first call", async function () {
    // execute transaction
    await runtime.executeTx(txnParams, program, []);

    const globalCounter = runtime.getGlobalState(txnParams.appId, stringToBytes(key));
    assert.isDefined(globalCounter); // there should be a value present with key "counter"
    assert.equal(globalCounter, BIGINT1);

    const localCounter = getAcc(runtime, john).getLocalState(txnParams.appId, stringToBytes(key)); // get local value from john account
    assert.isDefined(localCounter); // there should be a value present in local state with key "counter"
    assert.equal(localCounter, BIGINT1);
  });

  it("should update counter by +1 for both global and local states on second call", async function () {
    const globalCounter = runtime.getGlobalState(txnParams.appId, stringToBytes(key)) as bigint;
    const localCounter = getAcc(runtime, john).getLocalState(txnParams.appId, stringToBytes(key)) as bigint;

    // verfify that both counters are set to 1 (by the previous test)
    assert.equal(globalCounter, BIGINT1);
    assert.equal(localCounter, BIGINT1);

    // execute transaction
    await runtime.executeTx(txnParams, program, []);

    // after execution the counters should be updated by +1
    const newGlobalCounter = runtime.getGlobalState(txnParams.appId, stringToBytes(key));
    const newLocalCounter = getAcc(runtime, john).getLocalState(txnParams.appId, stringToBytes(key));

    assert.equal(newGlobalCounter, globalCounter + BIGINT1);
    assert.equal(newLocalCounter, localCounter + BIGINT1);
  });
});
