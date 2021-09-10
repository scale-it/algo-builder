import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Knowable creatable ID", function () {
  useFixture("knowable-id");
  const john = new AccountStore(10e6);

  let runtime: Runtime;
  let approvalProgram: string;
  let approvalProgramPass: string;
  let approvalProgramFail: string;
  let clearProgram: string;
  let flags: AppDeploymentFlags;
  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    approvalProgram = getProgram('approval.teal');
    approvalProgramPass = getProgram('approval-pass.teal');
    approvalProgramFail = getProgram('approval-fail.teal');
    clearProgram = getProgram('clear.teal');

    flags = {
      sender: john.account,
      globalBytes: 1,
      globalInts: 2,
      localBytes: 1,
      localInts: 1,
      appArgs: []
    };
  });

  it("should store correct asset/App ID", function () {
    const txGroup: types.ExecParams[] = [
      {
        type: types.TransactionType.DeployASA,
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        asaName: 'gold',
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.DeployApp,
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        approvalProgram: approvalProgram,
        clearProgram: clearProgram,
        localInts: 1,
        localBytes: 1,
        globalInts: 1,
        globalBytes: 1,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.DeployApp,
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        approvalProgram: approvalProgramPass,
        clearProgram: clearProgram,
        localInts: 1,
        localBytes: 1,
        globalInts: 2,
        globalBytes: 1,
        payFlags: { totalFee: 1000 }
      }
    ];
    runtime.executeTx(txGroup);
    const appInfoFirst = runtime.getAppInfoFromName(approvalProgram, clearProgram);
    const appInfoSecond = runtime.getAppInfoFromName(approvalProgramPass, clearProgram);
    const assetInfo = runtime.getAssetInfoFromName('gold');

    let result = runtime.getGlobalState(appInfoFirst?.appID as number, 'first');
    assert.equal(result, BigInt(assetInfo?.assetIndex as number));

    result = runtime.getGlobalState(appInfoSecond?.appID as number, 'second');
    assert.equal(result, BigInt(appInfoFirst?.appID as number));
  });

  it("should fail if program tries to access non existent transaction", function () {
    const txGroup: types.ExecParams[] = [
      {
        type: types.TransactionType.DeployASA,
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        asaName: 'gold',
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.DeployApp,
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        approvalProgram: approvalProgramFail,
        clearProgram: clearProgram,
        localInts: 1,
        localBytes: 1,
        globalInts: 1,
        globalBytes: 1,
        payFlags: { totalFee: 1000 }
      }
    ];
    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TEAL.GROUP_INDEX_EXIST_ERROR
    );
  });
});
