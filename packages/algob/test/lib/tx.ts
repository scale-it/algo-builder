import { encodeNote, types } from "@algo-builder/runtime";
import { ConfirmedTxInfo } from "algosdk";
import { assert } from "chai";
import sinon from 'sinon';
import { TextEncoder } from "util";

import { executeTransaction } from "../../src";
import { ERRORS } from "../../src/internal/core/errors";
import { DeployerDeployMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { Deployer } from "../../src/types";
import { expectBuilderErrorAsync } from "../helpers/errors";
import { mkEnv } from "../helpers/params";
import { bobAcc } from "../mocks/account";
import { mockSuggestedParam } from "../mocks/tx";
import { AlgoOperatorDryRunImpl } from "../stubs/algo-operator";

describe("Note in TxParams", () => {
  const encoder = new TextEncoder();
  const note = "Hello Algob!";
  const noteb64 = "asdisaddas";

  it("Both notes given", () => {
    const result = encodeNote(note, noteb64);
    assert.deepEqual(result, encoder.encode(noteb64), "noteb64 not encoded");
  });

  it("Only note given", () => {
    const result = encodeNote(note, undefined);
    assert.deepEqual(result, encoder.encode(note), "note not encoded");
  });

  it("Only noteb64 given", () => {
    const result = encodeNote(undefined, noteb64);
    assert.deepEqual(result, encoder.encode(noteb64), "noteb64 not encoded");
  });
});

describe("Opt-In to ASA", () => {
  function mkASA (): types.ASADef {
    return {
      total: 1,
      decimals: 1,
      unitName: 'ASA',
      defaultFrozen: false
    };
  }

  let deployer: Deployer;
  let execParams: types.OptInASAParam;
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
      type: types.TransactionType.OptInASA,
      sign: types.SignType.SecretKey,
      payFlags: {},
      fromAccount: bobAcc,
      assetID: 1
    };
    sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => mockSuggestedParam });
    expected = {
      'confirmed-round': 1,
      "asset-index": 1,
      'application-index': 1,
      'global-state-delta': "string",
      'local-state-delta': "string"
    };
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
