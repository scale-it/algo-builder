import { encodeNote, types } from "@algo-builder/runtime";
import { ConfirmedTxInfo, SuggestedParams } from "algosdk";
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

  const s: SuggestedParams = {
    flatFee: false,
    fee: 100,
    firstRound: 2,
    lastRound: 100,
    genesisID: 'testnet-v1.0',
    genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
  };

  const account = {
    addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
    sk: new Uint8Array([28, 45, 45, 15, 70, 188, 57, 228, 18, 21, 42,
      228, 33, 187, 222, 162, 89, 15, 22, 52, 143, 171, 182, 17, 168,
      238, 96, 177, 12, 163, 243, 231, 160, 203, 241, 203, 176, 185,
      4, 26, 16, 101, 217, 179, 83, 157, 119, 28, 82, 234, 204,
      209, 249, 29, 28, 24, 97, 122, 116, 86, 135, 163, 236, 253])
  };
  let deployer: Deployer;
  let execParams: types.OptInASAParam;
  let algod: AlgoOperatorDryRunImpl;
  let fn: any;
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
      fromAccount: account,
      assetID: 1
    };
    fn = sinon.stub(algod.algodClient, "getTransactionParams")
      .returns({ do: async () => s });
    expected = {
      'confirmed-round': 1,
      "asset-index": 1,
      'application-index': 1,
      'global-state-delta': "string",
      'local-state-delta': "string"
    };
  });

  afterEach(() => {
    fn.restore();
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
      "gold"
    );
  });

  it("Should set asset id to asset id of asset name passed", async () => {
    execParams.assetID = "silver";

    const res = await executeTransaction(deployer, execParams);

    assert.deepEqual(res, expected);
  });
});
