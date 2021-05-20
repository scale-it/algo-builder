import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { SignType, TransactionType, UpdateSSCParam } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("App Update Test", function () {
  useFixture("app-update");
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + 1000; // 1000 to cover fee
  const john = new AccountStore(1e30);
  const alice = new AccountStore(minBalance + 1000);

  let runtime: Runtime;
  let approvalProgram: string;
  let clearProgram: string;
  let appId: number;
  let groupTx: UpdateSSCParam[];

  this.beforeEach(async function () {
    runtime = new Runtime([john, alice]); // setup test
    approvalProgram = getProgram('approval_program.teal');
    clearProgram = getProgram('clear_program.teal');
    const flags = {
      sender: john.account,
      globalBytes: 5,
      globalInts: 5,
      localBytes: 5,
      localInts: 5
    };

    appId = runtime.addApp(flags, {}, approvalProgram, clearProgram);

    groupTx = [
      {
        type: TransactionType.UpdateSSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        appID: appId,
        newApprovalProgram: approvalProgram,
        newClearProgram: clearProgram,
        payFlags: {},
        appArgs: ['int:2']
      },
      {
        type: TransactionType.UpdateSSC,
        sign: SignType.SecretKey,
        fromAccount: john.account,
        appID: appId,
        newApprovalProgram: approvalProgram,
        newClearProgram: clearProgram,
        payFlags: {},
        appArgs: ['int:5']
      }
    ];
  });

  /**
   * Create 2 transactions in a group: `app_update(n=2), app_update(n=5)`.
   * Check the expected `app.counter == 2, app.total=7`
   */
  it("First case: (app_update(n=2) + app_update(n=5))", function () {
    runtime.executeTx(groupTx);

    const globalCounter = runtime.getGlobalState(appId, "counter");
    const total = runtime.getGlobalState(appId, "total");
    assert(globalCounter === 2n, "failed counter");
    assert(total === 7n, "failed total");
  });

  /**
   * Create 2 transactions in a group: `app_update(n=5), app_update(n=2)`.
   * Check the expected `app.counter == 2, app.total=13`
   */
  it("Second case: (app_update(n=5) + app_update(n=2))", function () {
    groupTx[0].appArgs = ['int:5'];
    groupTx[1].appArgs = ['int:2'];

    runtime.executeTx(groupTx);

    const globalCounter = runtime.getGlobalState(appId, "counter");
    const total = runtime.getGlobalState(appId, "total");
    assert(globalCounter === 2n, "failed counter");
    assert(total === 13n, "failed total");
  });

  /**
   * Run tx group: `app_update(n=2), app_update(n=5)` in a loop 1000 times.
   * This should fail because TEAL doesn't support negative numbers, and while looping
   * negative number is encountered
   */
  it("Third case: (app_update(n=2) + app_update(n=5)) * 1000", function () {
    expectRuntimeError(
      function () {
        for (let i = 0; i < 1000; ++i) {
          runtime.executeTx(groupTx);
        }
      },
      RUNTIME_ERRORS.TEAL.UINT64_UNDERFLOW
    );
  });

  /**
   * Run tx group: `app_update(n=5), app_update(n=2)` in a loop 1000 times.
   * The expected state should be: `app.counter == 2000`, `app.total = 3010
   */
  it("Fourth case: (app_update(n=5) + app_update(n=2)) * 1000", async function () {
    groupTx[0].appArgs = ['int:5'];
    groupTx[1].appArgs = ['int:2'];

    for (let i = 0; i < 1000; ++i) {
      runtime.executeTx(groupTx);
    }

    const globalCounter = runtime.getGlobalState(appId, "counter");
    const total = runtime.getGlobalState(appId, "total");
    assert.equal(globalCounter, 2000n, "counter mismatch");
    assert.equal(total, 3010n, "total mismatch");
  });
});
