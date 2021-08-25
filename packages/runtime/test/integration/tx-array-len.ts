import { aliceAcc, bobAcc } from "@algo-builder/algob/test/mocks/account";
import { types } from "@algo-builder/web";
import { assert } from "chai";

import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../build/lib/constants";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { johnAccount } from "../mocks/account";

describe("Algorand Stateful Smart Contracts - Consensus Params", function () {
  useFixture("stateful");
  const fee = 1000;
  const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + fee;
  const john = new AccountStore(minBalance + fee);

  const txnParams: types.ExecParams = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: john.account,
    appID: 0,
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
    txnParams.appID = runtime.addApp({
      sender: john.account,
      globalBytes: 2,
      globalInts: 2,
      localBytes: 3,
      localInts: 3
    }, {}, approvalProgram, clearProgram);

    // opt-in to the app
    runtime.optInToApp(john.address, txnParams.appID, {}, {});
  });

  it("should throw error if applicationArgs length > 16", function () {
    const appArgs: string[] = [];
    for (let i = 0; i < 17; i++) {
      appArgs.push(`int:${i}`);
    }

    expectRuntimeError(
      () => runtime.executeTx({ ...txnParams, appArgs: appArgs }),
      RUNTIME_ERRORS.GENERAL.INVALID_APP_ARGS_LEN
    );
    expectRuntimeError(
      () =>
        runtime.executeTx([
          { ...txnParams, appArgs: appArgs },
          { ...txnParams, appArgs: ['str:copa', 'str:america'] }
        ]),
      RUNTIME_ERRORS.GENERAL.INVALID_APP_ARGS_LEN
    );

    appArgs.pop(); // len is 16 now
    assert.doesNotThrow(() => runtime.executeTx({ ...txnParams, appArgs: appArgs }));
  });

  it("should throw error if tx.accounts array length > 4", function () {
    const txAccounts: string[] =
      [aliceAcc.addr, bobAcc.addr, johnAccount.addr, bobAcc.addr, bobAcc.addr];

    expectRuntimeError(
      () => runtime.executeTx({ ...txnParams, accounts: txAccounts }),
      RUNTIME_ERRORS.GENERAL.INVALID_TX_ACCOUNTS_LEN
    );
    expectRuntimeError(
      () =>
        runtime.executeTx([
          { ...txnParams, accounts: txAccounts },
          { ...txnParams, accounts: [aliceAcc.addr] }
        ]),
      RUNTIME_ERRORS.GENERAL.INVALID_TX_ACCOUNTS_LEN
    );

    txAccounts.pop(); // len is 4 now
    assert.doesNotThrow(() => runtime.executeTx({ ...txnParams, accounts: txAccounts }));
  });

  it("should throw error if [tx.accounts + tx.foreignApps + tx.foreignAssets] array length exceeds 8", function () {
    const txParams = {
      ...txnParams,
      accounts: [aliceAcc.addr, bobAcc.addr, johnAccount.addr, bobAcc.addr],
      foreignApps: [11, 22],
      foreignAssets: [101, 202]
    };

    expectRuntimeError(
      () => runtime.executeTx({
        ...txParams,
        foreignAssets: [...txParams.foreignAssets, 303] // exceeding total len by 1
      }),
      RUNTIME_ERRORS.GENERAL.MAX_REFERENCES_EXCEEDED
    );
    expectRuntimeError(
      () => runtime.executeTx({
        ...txParams,
        foreignApps: [...txParams.foreignApps, 33] // exceeding len by 1
      }),
      RUNTIME_ERRORS.GENERAL.MAX_REFERENCES_EXCEEDED
    );
    expectRuntimeError(
      () => runtime.executeTx({
        ...txParams,
        accounts: [...txParams.accounts, bobAcc.addr],
        foreignApps: undefined
      }),
      RUNTIME_ERRORS.GENERAL.INVALID_TX_ACCOUNTS_LEN // in this case total len < 8, but accounts length is still limited to 4
    );

    assert.doesNotThrow(() => runtime.executeTx(txParams)); // should pass as total len is == 8
  });
});

describe("TEALv4: Dynamic Opcode Cost calculation", function () {
  useFixture("dynamic-op-cost");
  const john = new AccountStore(10e6);

  let runtime: Runtime;
  let approvalProgramPass: string;
  let approvalProgramFail: string;
  let clearProgram: string;
  let flags: AppDeploymentFlags;
  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    approvalProgramPass = getProgram('approval-pass.teal');
    approvalProgramFail = getProgram('approval-fail.teal');
    clearProgram = getProgram('clear.teal');

    flags = {
      sender: john.account,
      globalBytes: 1,
      globalInts: 1,
      localBytes: 1,
      localInts: 1
    };
  });

  it("should fail during create application if pragma version <= 3", function () {
    expectRuntimeError(
      () => runtime.addApp(flags, {}, approvalProgramFail, clearProgram),
      RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
    );
  });

  it("should pass during create application if pragma version >= 4", function () {
    // same program with teal version == 4. Since cost is calculation during execution,
    // this code will pass.
    assert.doesNotThrow(() => runtime.addApp(flags, {}, approvalProgramPass, clearProgram));
  });
});
