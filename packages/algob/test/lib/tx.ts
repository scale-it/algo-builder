import { encodeNote, types } from "@algo-builder/runtime";
import { Action, SuggestedParams } from "algosdk";
import { assert } from "chai";
import sinon from 'sinon';
import { TextEncoder } from "util";

import { executeTransaction, getSuggestedParams } from "../../src";
import { DeployerDeployMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import * as tx from "../../src/lib/tx";
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
  const s: SuggestedParams = {
    flatFee: false,
    fee: 100,
    firstRound: 0,
    lastRound: 100,
    genesisID: 'testnet-v1.0',
    genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
  };
  it("should opt-in to asa using asset id as number", async () => {
    const env = mkEnv("network1");
    const algod = new AlgoOperatorDryRunImpl();
    const deployerCfg = new DeployerConfig(env, algod);
    // deployerCfg.asaDefs = { MY_ASA: mkASA() };
    const deployer = new DeployerDeployMode(deployerCfg);
    const execParams: types.ExecParams = {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.SecretKey,
      payFlags: {},
      fromAccount: { addr: "", sk: new Uint8Array(0) },
      assetID: 1
    };
    // const fn = sinon.stub(tx, "getSuggestedParams").resolves(s);
    /* const fn = sinon.stub(algod.algodClient, "getTransactionParams").returns(
      function do(): Promise<SuggestedParams> {return s});
    //algod.algodClient.getTransactionParams. */
    await executeTransaction(deployer, execParams);

    // fn.restore();
  });
});
