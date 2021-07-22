import { types } from "@algo-builder/runtime";
import { ERRORS, tx as webTx, types as wtypes } from "@algo-builder/web";
import algosdk, { decodeSignedTransaction, encodeAddress, modelsv2 } from "algosdk";
import { assert } from "chai";
import { isArray } from "lodash";
import sinon from 'sinon';
import { TextEncoder } from "util";

import { executeTransaction } from "../../src";
import { DeployerDeployMode, DeployerRunMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { Deployer } from "../../src/types";
import { expectBuilderError, expectBuilderErrorAsync } from "../helpers/errors";
import { mkEnv } from "../helpers/params";
import { useFixtureProject, useFixtureProjectCopy } from "../helpers/project";
import { aliceAcc, bobAcc } from "../mocks/account";
import { mockAssetInfo, mockLsig, mockSuggestedParam } from "../mocks/tx";
import { AlgoOperatorDryRunImpl } from "../stubs/algo-operator";

describe("Note in TxParams", () => {
  const encoder = new TextEncoder();
  const note = "Hello Algob!";
  const noteb64 = "asdisaddas";

  it("Both notes given", () => {
    const result = webTx.encodeNote(note, noteb64);
    assert.deepEqual(result, encoder.encode(noteb64), "noteb64 not encoded");
  });

  it("Only note given", () => {
    const result = webTx.encodeNote(note, undefined);
    assert.deepEqual(result, encoder.encode(note), "note not encoded");
  });

  it("Only noteb64 given", () => {
    const result = webTx.encodeNote(undefined, noteb64);
    assert.deepEqual(result, encoder.encode(noteb64), "noteb64 not encoded");
  });
});

function mkASA (): wtypes.ASADef {
  return {
    total: 1,
    decimals: 1,
    unitName: 'ASA',
    defaultFrozen: false
  };
}

describe("Opt-In to ASA", () => {
  useFixtureProject("config-project");

  let deployer: Deployer;
  let execParams: wtypes.OptInASAParam;
  let algod: AlgoOperatorDryRunImpl;
  let expected: modelsv2.PendingTransactionResponse;
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployerCfg.asaDefs = { silver: mkASA() };
    deployer = new DeployerDeployMode(deployerCfg);
    await deployer.deployASA("silver", { creator: deployer.accounts[0] });
    execParams = {
      type: wtypes.TransactionType.OptInASA,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      assetID: 1
    };
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);
    expected = {
      confirmedRound: 1,
      assetIndex: 1,
      applicationIndex: 1
    } as modelsv2.PendingTransactionResponse;
  });

  afterEach(() => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
  });

  it("should opt-in to asa using asset id as number", async () => {
    const res = await executeTransaction(deployer, execParams);

    assert.deepEqual(res, expected);
  });

  it("Should fail if asset name is passed but not found in checkpoints", async () => {
    execParams.assetID = "unknown";

    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParams),
      ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_NOT_DEFINED,
      "unknown"
    );
  });

  it("Should set asset id to asset id of asset name passed", async () => {
    execParams.assetID = "silver";

    const res = await executeTransaction(deployer, execParams);

    assert.deepEqual(res, expected);
  });
});

describe("ASA modify fields", () => {
  useFixtureProject("config-project");
  let deployer: Deployer;
  let execParams: wtypes.ModifyAssetParam;
  let algod: AlgoOperatorDryRunImpl;
  let assetFields: wtypes.AssetModFields;
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployer = new DeployerDeployMode(deployerCfg);
    assetFields = {
      manager: "",
      clawback: bobAcc.addr
    };
    execParams = {
      type: wtypes.TransactionType.ModifyAsset,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      assetID: 1,
      fields: assetFields
    };
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
  });

  /**
   * Verifies correct asset fields are sent to network
   * @param rawTxns rawTxns Signed transactions in Uint8Array
   */
  function checkTx (rawTxns: Uint8Array | Uint8Array[]): Promise<modelsv2.PendingTransactionResponse> {
    if (isArray(rawTxns)) {
      // verify here if group tx
    } else {
      const tx: any = decodeSignedTransaction(rawTxns).txn;
      // Verify if fields are set correctly
      assert.isUndefined(tx.assetManager);
      assert.isUndefined(tx.assetReserve);
      assert.equal(encodeAddress(tx.assetFreeze.publicKey), mockAssetInfo.params.freeze);
      assert.equal(encodeAddress(tx.assetClawback.publicKey), assetFields.clawback);
    }
    (algod.sendAndWait as sinon.SinonStub).restore();
    return algod.sendAndWait(rawTxns);
  }

  it("Should set fields, freeze is not sent, therefore it should be picked from assetInfo", async () => {
    // Manager should be set to ""(sent as undefined to network)
    // Clawback should be updated
    sinon.stub(algod, "sendAndWait").callsFake(checkTx);

    await executeTransaction(deployer, execParams);
  });
});

describe("Delete ASA and SSC", () => {
  useFixtureProjectCopy("stateful");
  let deployer: Deployer;
  let algod: AlgoOperatorDryRunImpl;
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployerCfg.asaDefs = { silver: mkASA() };
    deployer = new DeployerDeployMode(deployerCfg);
    await deployer.deployASA("silver", { creator: deployer.accounts[0] });
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
  });

  it("Should delete ASA, and set delete boolean in ASAInfo", async () => {
    const execParams: wtypes.DestroyAssetParam = {
      type: wtypes.TransactionType.DestroyAsset,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      assetID: "silver"
    };
    await executeTransaction(deployer, execParams);

    const res = deployer.getASAInfo("silver");
    assert.equal(res.deleted, true);
  });

  it("Should delete ASA If asset index is used, instead of asset name", async () => {
    const execParams: wtypes.DestroyAssetParam = {
      type: wtypes.TransactionType.DestroyAsset,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      assetID: 1
    };
    await executeTransaction(deployer, execParams);

    const res = deployer.getASAInfo("silver");
    assert.equal(res.deleted, true);
  });

  it("Should not fail if ASA is not in checkpoints", async () => {
    const execParams: wtypes.DestroyAssetParam = {
      type: wtypes.TransactionType.DestroyAsset,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      assetID: 2
    };
    await executeTransaction(deployer, execParams);
  });

  it("Should delete SSC, set delete boolean in latest SSCInfo", async () => {
    const flags: types.AppDeploymentFlags = {
      sender: bobAcc,
      localBytes: 1,
      localInts: 1,
      globalBytes: 1,
      globalInts: 1
    };
    const info = await deployer.deployApp("approval.teal", "clear.teal", flags, {});
    const execParams: wtypes.AppCallsParam = {
      type: wtypes.TransactionType.DeleteApp,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      appID: info.appID
    };

    await executeTransaction(deployer, execParams);

    const res = deployer.getApp("approval.teal", "clear.teal");
    assert.isDefined(res);
    if (res) assert.equal(res.deleted, true);
  });

  it("Should not fail if SSC is not in checkpoints", async () => {
    const execParams: wtypes.AppCallsParam = {
      type: wtypes.TransactionType.DeleteApp,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      appID: 23
    };
    await executeTransaction(deployer, execParams);
  });
});

describe("Delete ASA and SSC transaction flow(with functions and executeTransaction)", () => {
  useFixtureProject("stateful");
  let deployer: Deployer;
  let algod: AlgoOperatorDryRunImpl;
  let appID: number;
  let assetID: number;
  const assetName = "silver";
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployerCfg.asaDefs = { silver: mkASA() };
    deployer = new DeployerDeployMode(deployerCfg);
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);

    // deploy  and delete asset
    const asaInfo = await deployer.deployASA(assetName, { creator: deployer.accounts[0] });
    assetID = asaInfo.assetIndex;
    const execParams: wtypes.DestroyAssetParam = {
      type: wtypes.TransactionType.DestroyAsset,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      assetID: 1
    };
    await executeTransaction(deployer, execParams);

    // deploy and delete app
    const flags: types.AppDeploymentFlags = {
      sender: bobAcc,
      localBytes: 1,
      localInts: 1,
      globalBytes: 1,
      globalInts: 1
    };
    const info = await deployer.deployApp("approval.teal", "clear.teal", flags, {});
    appID = info.appID;
    const execParam: wtypes.AppCallsParam = {
      type: wtypes.TransactionType.DeleteApp,
      sign: wtypes.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      appID: info.appID
    };
    await executeTransaction(deployer, execParam);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
  });

  it("should throw error with opt-in asa functions, if asa exist and deleted", async () => {
    await expectBuilderErrorAsync(
      async () => await deployer.optInAcountToASA(assetName, 'acc-name-1', {}),
      ERRORS.GENERAL.ASSET_DELETED
    );

    await expectBuilderErrorAsync(
      async () => await deployer.optInLsigToASA(assetName, mockLsig, {}),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should pass with opt-in asa functions, if asa doesn't exist in checkpoint", async () => {
    await deployer.optInAcountToASA('23', 'acc-name-1', {});

    await deployer.optInLsigToASA('233212', mockLsig, {});
  });

  it("should throw error with opt-in ssc functions, if ssc exist and deleted", async () => {
    await expectBuilderErrorAsync(
      async () => await deployer.optInAccountToApp(bobAcc, appID, {}, {}),
      ERRORS.GENERAL.APP_DELETED
    );

    await expectBuilderErrorAsync(
      async () => await deployer.optInLsigToApp(appID, mockLsig, {}, {}),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should pass with opt-in ssc functions, if ssc doesn't exist in checkpoint", async () => {
    await deployer.optInAccountToApp(bobAcc, 122, {}, {});

    await deployer.optInLsigToApp(12223, mockLsig, {}, {});
  });

  it("should throw error with update ssc function, if ssc exist and deleted", async () => {
    await expectBuilderErrorAsync(
      async () => await deployer.updateApp(bobAcc, {}, appID, "approval.teal", "clear.teal", {}),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should pass with update ssc functions, if ssc doesn't exist in checkpoint", async () => {
    await deployer.updateApp(bobAcc, {}, 123, "approval.teal", "clear.teal", {});
  });

  it("should fail if user tries to opt-in through execute tx", async () => {
    const execParam: wtypes.OptInASAParam = {
      type: wtypes.TransactionType.OptInASA,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      assetID: assetID
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should fail if user tries to modify through execute tx", async () => {
    const execParam: wtypes.ModifyAssetParam = {
      type: wtypes.TransactionType.ModifyAsset,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      assetID: assetID,
      fields: {}
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should fail if user tries to freeze through execute tx", async () => {
    const execParam: wtypes.FreezeAssetParam = {
      type: wtypes.TransactionType.FreezeAsset,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      assetID: assetID,
      freezeTarget: "acc-name-1",
      freezeState: true
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should fail if user tries to revoke through execute tx", async () => {
    const execParam: wtypes.RevokeAssetParam = {
      type: wtypes.TransactionType.RevokeAsset,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      assetID: assetID,
      recipient: bobAcc.addr,
      revocationTarget: "target",
      amount: 1000
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should fail if user tries to destroy through execute tx", async () => {
    const execParam: wtypes.DestroyAssetParam = {
      type: wtypes.TransactionType.DestroyAsset,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      assetID: assetID
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should fail if user tries to transfer asa through execute tx", async () => {
    const execParam: wtypes.AssetTransferParam = {
      type: wtypes.TransactionType.TransferAsset,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      assetID: assetID,
      toAccountAddr: aliceAcc.addr,
      amount: 12
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should pass if user tries to opt-out through execute tx", async () => {
    const execParam: wtypes.AssetTransferParam = {
      type: wtypes.TransactionType.TransferAsset,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: { closeRemainderTo: bobAcc.addr },
      assetID: assetID,
      toAccountAddr: aliceAcc.addr,
      amount: 12
    };
    await executeTransaction(deployer, execParam);
  });

  it("should throw error if user tries to delete deleted app", async () => {
    const execParam: wtypes.AppCallsParam = {
      type: wtypes.TransactionType.DeleteApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      appID: appID
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should throw error if user tries to update deleted app", async () => {
    const execParam: wtypes.UpdateAppParam = {
      type: wtypes.TransactionType.UpdateApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      appID: appID,
      newApprovalProgram: "approval.teal",
      newClearProgram: "clear.teal"
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should throw error if user tries to call deleted app", async () => {
    const execParam: wtypes.AppCallsParam = {
      type: wtypes.TransactionType.CallNoOpSSC,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      appID: appID
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should throw error if user tries to opt-in deleted app", async () => {
    const execParam: wtypes.OptInToAppParam = {
      type: wtypes.TransactionType.OptInToApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      appID: appID
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should pass if user tries to opt-out deleted app", async () => {
    const execParam: wtypes.AppCallsParam = {
      type: wtypes.TransactionType.CloseApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      appID: appID
    };
    await expectBuilderErrorAsync(
      async () => await executeTransaction(deployer, execParam),
      ERRORS.GENERAL.APP_DELETED
    );

    const execParams: wtypes.AppCallsParam = {
      type: wtypes.TransactionType.ClearApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      appID: appID
    };
    await executeTransaction(deployer, execParams);
  });

  it("should pass if user tries delete app that doesn't exist in checkpoint", async () => {
    const execParam: wtypes.DestroyAssetParam = {
      type: wtypes.TransactionType.DestroyAsset,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      payFlags: {},
      assetID: 123
    };

    await executeTransaction(deployer, execParam);
  });

  it("should pass if user tries delete (asset + app) that doesn't exist in checkpoint", async () => {
    const txGroup: wtypes.ExecParams[] = [
      {
        type: wtypes.TransactionType.DestroyAsset,
        sign: wtypes.SignType.SecretKey,
        fromAccount: bobAcc,
        payFlags: {},
        assetID: 123
      },
      {
        type: wtypes.TransactionType.DeleteApp,
        sign: wtypes.SignType.SecretKey,
        fromAccount: bobAcc,
        payFlags: {},
        appID: 12213
      }
    ];

    await executeTransaction(deployer, txGroup);
  });
});

describe("Deploy, Delete transactions test in run mode", () => {
  useFixtureProject("stateful");
  let deployer: Deployer;
  let algod: AlgoOperatorDryRunImpl;
  let deployerCfg: DeployerConfig;
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    deployerCfg = new DeployerConfig(env, algod);
    deployerCfg.asaDefs = { silver: mkASA() };
    deployer = new DeployerRunMode(deployerCfg);
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
  });

  it("should deploy asa in run mode", async () => {
    const execParams: wtypes.ExecParams = {
      type: wtypes.TransactionType.DeployASA,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      asaName: 'silver',
      payFlags: {}
    };

    await executeTransaction(deployer, execParams);

    // should not be stored in checkpoint if in run mode
    expectBuilderError(
      () => deployer.getASAInfo('silver'),
      ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_NOT_DEFINED
    );
  });

  it("should deploy application in run mode", async () => {
    const execParams: wtypes.ExecParams = {
      type: wtypes.TransactionType.DeployApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      approvalProgram: "approval.teal",
      clearProgram: "clear.teal",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
      payFlags: {}
    };
    await executeTransaction(deployer, execParams);

    // should not be stored in checkpoint if in run mode
    assert.isUndefined(deployer.getApp("approval.teal", "clear.teal"));
  });

  it("should delete application in run mode", async () => {
    deployer = new DeployerDeployMode(deployerCfg);
    let execParams: wtypes.ExecParams = {
      type: wtypes.TransactionType.DeployApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      approvalProgram: "approval.teal",
      clearProgram: "clear.teal",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
      payFlags: {}
    };
    const appInfo = await executeTransaction(deployer, execParams);

    deployer = new DeployerRunMode(deployerCfg);
    execParams = {
      type: wtypes.TransactionType.DeleteApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      appID: appInfo.applicationIndex as number,
      payFlags: {}
    };

    await executeTransaction(deployer, execParams);

    const res = deployer.getApp("approval.teal", "clear.teal");
    assert.isDefined(res);
    assert.equal(res?.deleted, false);
  });
});

describe("Update transaction test in run mode", () => {
  useFixtureProject("stateful");
  let deployer: Deployer;
  let algod: AlgoOperatorDryRunImpl;
  let deployerCfg: DeployerConfig;
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    deployerCfg = new DeployerConfig(env, algod);
    deployer = new DeployerRunMode(deployerCfg);
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
  });

  it("should update in run mode", async () => {
    let execParams: wtypes.ExecParams = {
      type: wtypes.TransactionType.DeployApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      approvalProgram: "approval.teal",
      clearProgram: "clear.teal",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
      payFlags: {}
    };
    const appInfo = await executeTransaction(deployer, execParams);

    // should not be stored in checkpoint if in run mode
    assert.isUndefined(deployer.getApp("approval.teal", "clear.teal"));

    execParams = {
      type: wtypes.TransactionType.UpdateApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      appID: appInfo["applicationIndex"] as number,
      newApprovalProgram: "approval.teal",
      newClearProgram: "clear.teal",
      payFlags: {}
    };

    await executeTransaction(deployer, execParams);
    // should not be stored in checkpoint if in run mode
    assert.isUndefined(deployer.getApp("approval.teal", "clear.teal"));
  });

  it("deploy in deploy mode, update in run mode", async () => {
    deployer = new DeployerDeployMode(deployerCfg);
    let execParams: wtypes.ExecParams = {
      type: wtypes.TransactionType.DeployApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      approvalProgram: "approval.teal",
      clearProgram: "clear.teal",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
      payFlags: {}
    };
    await executeTransaction(deployer, execParams);
    const appInfo = deployer.getApp("approval.teal", "clear.teal");
    assert.isDefined(appInfo);

    deployer = new DeployerRunMode(deployerCfg);
    execParams = {
      type: wtypes.TransactionType.UpdateApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      appID: appInfo?.appID as number,
      newApprovalProgram: "approval.teal",
      newClearProgram: "clear.teal",
      payFlags: {}
    };

    await executeTransaction(deployer, execParams);
    assert.deepEqual(appInfo, deployer.getApp("approval.teal", "clear.teal"));
  });

  it("deploy in run mode, update in deploy mode", async () => {
    let execParams: wtypes.ExecParams = {
      type: wtypes.TransactionType.DeployApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      approvalProgram: "approval.teal",
      clearProgram: "clear.teal",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
      payFlags: {}
    };
    const appInfo = await executeTransaction(deployer, execParams);
    assert.isUndefined(deployer.getApp("approval.teal", "clear.teal"));

    deployer = new DeployerDeployMode(deployerCfg);
    execParams = {
      type: wtypes.TransactionType.UpdateApp,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      appID: appInfo["applicationIndex"] as number,
      newApprovalProgram: "approval.teal",
      newClearProgram: "clear.teal",
      payFlags: {}
    };

    await executeTransaction(deployer, execParams);
    // checkpoint is stored for the update
    assert.isDefined(deployer.getApp("approval.teal", "clear.teal"));
  });
});
