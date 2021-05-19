import { encodeNote, types } from "@algo-builder/runtime";
import { assert } from "chai";
import { TextEncoder } from "util";

import { ERRORS } from "../../src/internal/core/errors";
import { DeployerDeployMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { parseExecParams } from "../../src/lib/tx";
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

  let deployer: Deployer;
  let execParams: types.OptInASAParam;
  beforeEach(async () => {
    const env = mkEnv("network1");
    const algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    deployerCfg.asaDefs = { silver: mkASA() };
    deployer = new DeployerDeployMode(deployerCfg);
    await deployer.deployASA("silver", { creator: deployer.accounts[0] });
    execParams = {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.SecretKey,
      payFlags: {},
      fromAccount: { addr: "", sk: new Uint8Array(0) },
      assetID: 1
    };
  });

  it("should parse asset id as number while opt-in", async () => {
    const result = await parseExecParams(deployer, execParams, 0, new Map<number, [string, types.ASADef]>());
    if (result.type === types.TransactionType.OptInASA) {
      assert.equal(result.assetID, execParams.assetID);
    }
  });

  it("Should fail if asset name is passed but not found in checkpoints", async () => {
    execParams.assetID = "gold";
    await expectBuilderErrorAsync(
      async () => await parseExecParams(deployer, execParams, 0, new Map<number, [string, types.ASADef]>()),
      ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_NOT_DEFINED,
      "gold"
    );
  });

  it("Should set asset id to asset id of asset name passed", async () => {
    execParams.assetID = "silver";
    const result = await parseExecParams(deployer, execParams, 0, new Map<number, [string, types.ASADef]>());
    if (result.type === types.TransactionType.OptInASA) {
      assert.equal(result.assetID, -1);
    }
  });
});
