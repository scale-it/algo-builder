import { types } from "@algo-builder/web";
import { assert } from "chai";

import { AccountStore } from "../../../src";
import { convertToBuffer } from "../../../src/lib/parsing";
import { sdkTransactionToExecParams } from "../../../src/lib/txn";
import { Runtime } from "../../../src/runtime";
import { AccountStoreI } from "../../../src/types";
import { useFixture } from "../../helpers/integration";

describe("Convert encode Tx to ExecParams", function () {
  useFixture("asa-check");
  let john: AccountStoreI;
  let runtime: Runtime;

  this.beforeEach(() => {
    john = new AccountStore(1e9);
    runtime = new Runtime([john]);
  });

  it("test create Asset Program", () => {
    const sign: types.Sign = {
      sign: types.SignType.SecretKey,
      fromAccount: john.account
    };
    const execParams: types.DeployASAParam = {
      ...sign,
      type: types.TransactionType.DeployASA,
      asaName: 'gold',
      payFlags: { totalFee: 1000 }
    };

    execParams.asaDef = runtime.loadedAssetsDefs[execParams.asaName];

    const [encTx] = runtime.createTxnContext(execParams);

    // convert metadagaHash to buffer
    if (execParams.asaDef?.metadataHash && typeof execParams.asaDef?.metadataHash === 'string') {
      execParams.asaDef.metadataHash = convertToBuffer(execParams.asaDef.metadataHash);
    }

    assert.deepEqual(sdkTransactionToExecParams(encTx, sign, runtime.ctx), execParams);
  });
});
