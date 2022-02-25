import { types } from "@algo-builder/web";
import { stringToBytes } from "@algo-builder/web/build/lib/parsing";
import { assert } from "chai";
import { encodeBase64 } from "tweetnacl-ts";

import { AccountStore } from "../../../src";
import { encTxToExecParams } from "../../../src/lib/txn";
import { Runtime } from "../../../src/runtime";
import { AccountStoreI } from "../../../src/types";
import { useFixture } from "../../helpers/integration";

describe("Convert encode Tx to ExecParams", function () {
  let john: AccountStoreI;
  let smith: AccountStoreI;

  let runtime: Runtime;
  let execParams: types.ExecParams;
  this.beforeEach(() => {
    john = new AccountStore(1e9);
    smith = new AccountStore(1e9);

    runtime = new Runtime([john, smith]);
  });

  // helper - help convert and check param from EncTx to ExecParams
  function assertEncTxConvertedToExecParam (runtime: Runtime, execParams: types.ExecParams): void {
    const [encTx] = runtime.createTxnContext(execParams);
    const sign = {
      sign: types.SignType.SecretKey,
      fromAccount: execParams.fromAccount
    };
    // add approvalProgram and clearProgram to encTx
    if (execParams.type === types.TransactionType.DeployApp) {
      encTx.approvalProgram = execParams.approvalProgram;
      encTx.clearProgram = execParams.clearProgram;
    }

    assert.deepEqual(encTxToExecParams(encTx, sign as types.Sign, runtime.ctx), execParams);
  };

  describe("pay transaction", function () {
    it("convert Encode Tx(pay transaction) to ExecParams(TransferAlgo)", () => {
      execParams = {
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        type: types.TransactionType.TransferAlgo,
        fromAccountAddr: john.address,
        toAccountAddr: smith.address,
        amountMicroAlgos: 1000n,
        payFlags: {
          totalFee: 1000,
          closeRemainderTo: smith.address,
          rekeyTo: smith.address
        }
      };

      assertEncTxConvertedToExecParam(runtime, execParams);
    });
  });

  describe("asa Transactions", function () {
    useFixture("asa-check");
    it("Deploy ASA", () => {
      execParams = {
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        type: types.TransactionType.DeployASA,
        asaName: 'gold',
        payFlags: { totalFee: 1000 }
      };

      execParams.asaDef = runtime.loadedAssetsDefs[execParams.asaName];

      assertEncTxConvertedToExecParam(runtime, execParams);
    });

    it("Asset Freeze Transaction", () => {
      execParams = {
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        type: types.TransactionType.FreezeAsset,
        payFlags: {
          totalFee: 1000
        },
        assetID: 7,
        freezeTarget: smith.address,
        freezeState: true
      };
      assertEncTxConvertedToExecParam(runtime, execParams);
    });

    it("Asset Transfer", () => {
      execParams = {
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        type: types.TransactionType.TransferAsset,
        toAccountAddr: smith.address,
        amount: 10,
        assetID: 10,
        payFlags: {
          totalFee: 1000
        }
      };

      assertEncTxConvertedToExecParam(runtime, execParams);
    });

    it("Destroy Asset", () => {
      execParams = {
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        type: types.TransactionType.DestroyAsset,
        assetID: 10,
        payFlags: {
          totalFee: 1000
        }
      };

      assertEncTxConvertedToExecParam(runtime, execParams);
    });

    it("ModifyAsset", () => {
      execParams = {
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        type: types.TransactionType.ModifyAsset,
        assetID: 10,
        fields: {
          clawback: smith.address,
          freeze: smith.address,
          manager: john.address,
          reserve: smith.address
        },
        payFlags: {
          totalFee: 1000
        }
      };

      assertEncTxConvertedToExecParam(runtime, execParams);
    });
  });

  describe("keyreg transaction", function () {
    it("EncTx(keyreg tx) to ExecParam", () => {
      execParams = {
        type: types.TransactionType.KeyRegistration, // payment
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        voteKey: encodeBase64(stringToBytes('this-is-vote-key')),
        selectionKey: encodeBase64(stringToBytes("this-is-selection-key")),
        voteFirst: 43,
        voteLast: 1000,
        voteKeyDilution: 5,
        payFlags: { totalFee: 1000 }
      };

      assertEncTxConvertedToExecParam(runtime, execParams);
    });
  });

  describe("appl transaction", function () {
    useFixture('stateful');
    it("EncTx(deploy tx) to ExecParam(deploy Tx)", () => {
      execParams = {
        sign: types.SignType.SecretKey,
        fromAccount: john.account,
        type: types.TransactionType.DeployApp,
        approvalProgram: "counter-approval.teal",
        clearProgram: "clear.teal",
        globalBytes: 10,
        globalInts: 10,
        localBytes: 10,
        localInts: 10,
        payFlags: {
          totalFee: 1000
        }
      };

      assertEncTxConvertedToExecParam(runtime, execParams);
    });
  });
});
