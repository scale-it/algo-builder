import { assert } from "chai";

import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { ExecParams, SignType, TransactionType } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - Stateful Counter example", function () {
  useFixture("stateful");
  const fee = 1000;
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + fee;
  const john = new AccountStore(minBalance + fee);

  const txnParams: ExecParams = {
    type: TransactionType.CallNoOpSSC,
    sign: SignType.SecretKey,
    fromAccount: john.account,
    appId: 0,
    payFlags: { totalFee: fee }
  };

  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  this.beforeAll(function () {
    runtime = new Runtime([john]); // setup test
    approvalProgram = getProgram('counter-approval.teal');
    clearProgram = getProgram('clear.teal');

    // create new app
    txnParams.appId = runtime.addApp({
      sender: john.account,
      globalBytes: 32,
      globalInts: 32,
      localBytes: 8,
      localInts: 8
    }, {}, approvalProgram, clearProgram);

    // opt-in to the app
    runtime.optInToApp(john.address, txnParams.appId, {}, {});
  });

  const key = "counter";

  it("should initialize local counter to 0 after opt-in", function () {
    const localCounter = runtime.getAccount(john.address).getLocalState(txnParams.appId, key); // get local value from john account
    assert.isDefined(localCounter); // there should be a value present in local state with key "counter"
    assert.equal(localCounter, 0n);
  });

  it("should set global and local counter to 1 on first call", function () {
    runtime.executeTx(txnParams);

    const globalCounter = runtime.getGlobalState(txnParams.appId, key);
    assert.equal(globalCounter, 1n);

    const localCounter = runtime.getAccount(john.address).getLocalState(txnParams.appId, key); // get local value from john account
    assert.equal(localCounter, 1n);
  });

  it("should update counter by +1 for both global and local states on second call", function () {
    const globalCounter = runtime.getGlobalState(txnParams.appId, key) as bigint;
    const localCounter = runtime.getAccount(john.address).getLocalState(txnParams.appId, key) as bigint;

    // verfify that both counters are set to 1 (by the previous test)
    assert.equal(globalCounter, 1n);
    assert.equal(localCounter, 1n);

    runtime.executeTx(txnParams);

    // after execution the counters should be updated by +1
    const newGlobalCounter = runtime.getGlobalState(txnParams.appId, key);
    const newLocalCounter = runtime.getAccount(john.address).getLocalState(txnParams.appId, key);

    assert.equal(newGlobalCounter, globalCounter + 1n);
    assert.equal(newLocalCounter, localCounter + 1n);
  });
});
