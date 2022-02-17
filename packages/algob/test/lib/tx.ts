import { types } from "@algo-builder/runtime";
import { ERRORS, tx as webTx, types as wtypes } from "@algo-builder/web";
import algosdk, { decodeSignedTransaction, encodeAddress, makeAssetCreateTxn, Transaction } from "algosdk";
import { assert } from "chai";
import { isArray } from "lodash";
import sinon from 'sinon';
import { TextEncoder } from "util";

import { executeTransaction } from "../../src";
import { DeployerDeployMode, DeployerRunMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { ConfirmedTxInfo, Deployer } from "../../src/types";
import { expectBuilderError, expectBuilderErrorAsync } from "../helpers/errors";
import { mkEnv } from "../helpers/params";
import { useFixtureProject, useFixtureProjectCopy } from "../helpers/project";
import { aliceAcc, bobAcc } from "../mocks/account";
import { mockAssetInfo, mockGenesisInfo, mockLsig, mockSuggestedParam } from "../mocks/tx";
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

function stubAlgodGenesisAndTxParams (algodClient: algosdk.Algodv2): void {
  sinon.stub(algodClient, "getTransactionParams")
    .returns({ do: async () => mockSuggestedParam } as ReturnType<algosdk.Algodv2['getTransactionParams']>);
  sinon.stub(algodClient, "genesis")
    .returns({ do: async () => mockGenesisInfo } as ReturnType<algosdk.Algodv2['genesis']>);
}

describe("Opt-In to ASA", () => {
  useFixtureProject("config-project");

  let deployer: Deployer;
  let execParams: wtypes.OptInASAParam;
  let algod: AlgoOperatorDryRunImpl;
  let expected: ConfirmedTxInfo;
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
    stubAlgodGenesisAndTxParams(algod.algodClient);
    expected = {
      'confirmed-round': 1,
      'asset-index': 1,
      'application-index': 1,
      'global-state-delta': "string",
      'local-state-delta': "string"
    };
  });

  afterEach(() => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
    (algod.algodClient.genesis as sinon.SinonStub).restore();
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
    stubAlgodGenesisAndTxParams(algod.algodClient);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
    (algod.algodClient.genesis as sinon.SinonStub).restore();
  });

  /**
   * Verifies correct asset fields are sent to network
   * @param rawTxns rawTxns Signed transactions in Uint8Array
   */
  function checkTx (rawTxns: Uint8Array | Uint8Array[]): Promise<ConfirmedTxInfo> {
    if (isArray(rawTxns)) {
      // verify here if group tx
    } else {
      const tx: Transaction = decodeSignedTransaction(rawTxns).txn;
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
    stubAlgodGenesisAndTxParams(algod.algodClient);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
    (algod.algodClient.genesis as sinon.SinonStub).restore();
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

  it("Should delete SSC, set delete boolean in latest AppInfo", async () => {
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
    stubAlgodGenesisAndTxParams(algod.algodClient);

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
    (algod.algodClient.genesis as sinon.SinonStub).restore();
  });

  it("should throw error with opt-in asa functions, if asa exist and deleted", async () => {
    await expectBuilderErrorAsync(
      async () => await deployer.optInAccountToASA(assetName, 'acc-name-1', {}),
      ERRORS.GENERAL.ASSET_DELETED
    );

    await expectBuilderErrorAsync(
      async () => await deployer.optInLsigToASA(assetName, mockLsig, {}),
      ERRORS.GENERAL.ASSET_DELETED
    );
  });

  it("should pass with opt-in asa functions, if asa doesn't exist in checkpoint", async () => {
    await deployer.optInAccountToASA('23', 'acc-name-1', {});

    await deployer.optInLsigToASA('233212', mockLsig, {});
  });

  it("should throw error with opt-in app functions, if app exist and deleted", async () => {
    await expectBuilderErrorAsync(
      async () => await deployer.optInAccountToApp(bobAcc, appID, {}, {}),
      ERRORS.GENERAL.APP_DELETED
    );

    await expectBuilderErrorAsync(
      async () => await deployer.optInLsigToApp(appID, mockLsig, {}, {}),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should pass with opt-in app functions, if app doesn't exist in checkpoint", async () => {
    await deployer.optInAccountToApp(bobAcc, 122, {}, {});

    await deployer.optInLsigToApp(12223, mockLsig, {}, {});
  });

  it("should throw error with update app function, if app exist and deleted", async () => {
    await expectBuilderErrorAsync(
      async () => await deployer.updateApp(bobAcc, {}, appID, "approval.teal", "clear.teal", {}),
      ERRORS.GENERAL.APP_DELETED
    );
  });

  it("should pass with update app functions, if app doesn't exist in checkpoint", async () => {
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
      type: wtypes.TransactionType.CallApp,
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
    const execParam: wtypes.AppCallsParam = {
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
    stubAlgodGenesisAndTxParams(algod.algodClient);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
    (algod.algodClient.genesis as sinon.SinonStub).restore();
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

  it("should deploy application in deploy mode and save info by name", async () => {
    deployer = new DeployerDeployMode(deployerCfg);
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
      payFlags: {},
      appName: "dao-app"
    };
    await executeTransaction(deployer, execParams);

    // able to retrieve info by "appName"
    assert.isDefined(deployer.getAppByName("dao-app"));

    // do note that traditional way doesn't work if appName is passed
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
      appID: appInfo['application-index'],
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
    stubAlgodGenesisAndTxParams(algod.algodClient);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
    (algod.algodClient.genesis as sinon.SinonStub).restore();
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
      appID: appInfo['application-index'],
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
      appID: appInfo?.appID ?? 0,
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
      appID: appInfo['application-index'],
      newApprovalProgram: "approval.teal",
      newClearProgram: "clear.teal",
      payFlags: {}
    };

    await executeTransaction(deployer, execParams);
    // checkpoint is stored for the update
    assert.isDefined(deployer.getApp("approval.teal", "clear.teal"));
  });
});

describe("Deploy ASA without asa.yaml", () => {
  useFixtureProject("config-project");

  let deployer: Deployer;
  let algod: AlgoOperatorDryRunImpl;
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployerCfg.asaDefs = { silver: mkASA() };
    deployer = new DeployerDeployMode(deployerCfg);
    stubAlgodGenesisAndTxParams(algod.algodClient);
  });

  afterEach(async () => {
    (algod.algodClient.getTransactionParams as sinon.SinonStub).restore();
    (algod.algodClient.genesis as sinon.SinonStub).restore();
  });

  it("should deploy asa without asa.yaml", async () => {
    const exp = {
      total: 10000,
      decimals: 0,
      defaultFrozen: false,
      unitName: "SLV",
      url: "url",
      metadataHash: "12312442142141241244444411111133",
      note: "note"
    };
    const execParams: wtypes.ExecParams = {
      type: wtypes.TransactionType.DeployASA,
      sign: wtypes.SignType.SecretKey,
      fromAccount: bobAcc,
      asaName: 'silver-1',
      asaDef: exp,
      payFlags: {}
    };

    await executeTransaction(deployer, execParams);

    const res = deployer.getASAInfo("silver-1");
    assert.isDefined(res);
    assert.deepEqual(res.assetDef, exp);
  });
});

describe("SDK Transaction object", () => {
  useFixtureProject("config-project");

  let deployer: Deployer;
  let algod: AlgoOperatorDryRunImpl;
  beforeEach(async () => {
    const env = mkEnv("network1");
    algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployer = new DeployerDeployMode(deployerCfg);
    stubAlgodGenesisAndTxParams(algod.algodClient);
  });

  it("should sign and send transaction", async () => {
    const tx = makeAssetCreateTxn(
      bobAcc.addr, mockSuggestedParam.fee,
      mockSuggestedParam.firstRound, mockSuggestedParam.lastRound,
      undefined, mockSuggestedParam.genesisHash, mockSuggestedParam.genesisID,
      1e6, 0, false, undefined, undefined, undefined, undefined, "UM", "ASM", undefined
    );
    const transaction: wtypes.TransactionAndSign = {
      transaction: tx,
      sign: { sign: wtypes.SignType.SecretKey, fromAccount: bobAcc }
    };

    const res = await executeTransaction(deployer, transaction);
    assert.isDefined(res);
    assert.equal(res["confirmed-round"], 1);
    assert.equal(res["asset-index"], 1);
  });
});
