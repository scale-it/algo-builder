import { assert } from "chai";
import * as fs from "fs";

import {
  createNetCheckpoint,
  appendToCheckpoint,
  toCheckpointFileName,
  persistCheckpoint,
  loadCheckpoint,
  appendEnv
} from "../../../src/internal/util/script-checkpoints";
import { ScriptCheckpoint, ScriptNetCheckpoint } from "../../../src/types";
import { mkAlgobEnv } from "../../helpers/params";

function cleanupMutableData(netCheckpoint: ScriptNetCheckpoint, n: number): ScriptNetCheckpoint {
  assert.isNotNull(netCheckpoint.timestamp)
  netCheckpoint.timestamp = n
  return netCheckpoint
}

describe("Checkpoint", () => {
  it("Should create a network checkpoint", async () => {
    const beforeTimestamp = + new Date();
    const netCheckpoint = createNetCheckpoint();
    const afterTimestamp = + new Date();
    assert.isAtLeast(netCheckpoint.timestamp, beforeTimestamp);
    assert.isAtMost(netCheckpoint.timestamp, afterTimestamp);
    const clean = cleanupMutableData(netCheckpoint, 12345)
    assert.deepEqual(netCheckpoint, {
      timestamp: 12345
    });
  });

  it("Should append to a checkpoint map", async () => {
    const netCheckpoint = cleanupMutableData(createNetCheckpoint(), 34251);
    const checkpoint = appendToCheckpoint({}, "network213", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network213: {
        timestamp: 34251
      }
    });
    const netCheckpoint2 = cleanupMutableData(createNetCheckpoint(), 539);
    const checkpoint2 = appendToCheckpoint(checkpoint, "network5352", netCheckpoint2);
    assert.deepEqual(checkpoint2, {
      network213: {
        timestamp: 34251
      },
      network5352: {
        timestamp: 539
      }
    });
  });

  it("Should replace in checkpoint map", async () => {
    const netCheckpoint = cleanupMutableData(createNetCheckpoint(), 34251);
    const checkpoint = appendToCheckpoint({}, "network525", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network525: {
        timestamp: 34251
      }
    });
    const netCheckpoint2 = cleanupMutableData(createNetCheckpoint(), 539);
    const checkpoint2 = appendToCheckpoint(checkpoint, "network525", netCheckpoint2);
    assert.deepEqual(checkpoint2, {
      network525: {
        timestamp: 539
      }
    });
  });

  it("Should produce a checkpoint file name from script name", async () => {
    const checkpointFileName = toCheckpointFileName("script-1.js");
    assert.equal(checkpointFileName, "artifacts/script-1.js.cp.yaml");
  });

  it("Should capture config", async () => {
    const cp = appendEnv({}, mkAlgobEnv("myNetworkName"));
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 951)
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 951
      }
    });
  });

  it("Should capture config two calls", async () => {
    const cp = appendEnv(
      appendEnv(
        {},
        mkAlgobEnv("myNetworkName")),
      mkAlgobEnv("myNetworkName2"));
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 531)
    cp.myNetworkName2 = cleanupMutableData(cp.myNetworkName2, 201)
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 531
      },
      myNetworkName2: {
        timestamp: 201
      }
    });
  });

  it("Should default to empty cp if loading nonexistent file", async () => {
    const loadedCP = loadCheckpoint("nonexistent")
    assert.deepEqual(loadedCP, {});
  });

});

describe("Checkpoint with cleanup", () => {
  afterEach(() => {
    try {
      fs.rmdirSync("artifacts", { recursive: true })
    } catch (err) {
      // ignored
    }
  })

  it("Should persist and load the checkpoint", async () => {
    const origCP = appendToCheckpoint(
      {},
      "network124",
      createNetCheckpoint());
    persistCheckpoint("script-1.js", origCP)
    const loadedCP = loadCheckpoint("script-1.js")
    assert.deepEqual(loadedCP, origCP);
  });

})

//  LocalWords:  cp
