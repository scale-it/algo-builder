import { assert } from "chai";
import * as fs from "fs";

import {
  createNetCheckpoint,
  appendToCheckpoint,
  toCheckpointFileName,
  persistCheckpoint,
  loadCheckpoint,
  appendEnv,
  AlgobDeployerImpl,
  mergeCheckpoints
} from "../../src/lib/script-checkpoints";
import { ScriptCheckpoint, ScriptNetCheckpoint } from "../../src/types";
import { mkAlgobEnv } from "../helpers/params";

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
      timestamp: 12345,
      metadata: {}
    });
  });

  it("Should append to a checkpoint map", async () => {
    const netCheckpoint = cleanupMutableData(createNetCheckpoint(), 34251);
    const checkpoint = appendToCheckpoint({}, "network213", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network213: {
        timestamp: 34251,
        metadata: {}
      }
    });
    const netCheckpoint2 = cleanupMutableData(createNetCheckpoint(), 539);
    const checkpoint2 = appendToCheckpoint(checkpoint, "network5352", netCheckpoint2);
    assert.deepEqual(checkpoint2, {
      network213: {
        timestamp: 34251,
        metadata: {}
      },
      network5352: {
        timestamp: 539,
        metadata: {}
      }
    });
  });

  it("Should replace in checkpoint map", async () => {
    const netCheckpoint = cleanupMutableData(createNetCheckpoint(), 34251);
    const checkpoint = appendToCheckpoint({}, "network525", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network525: {
        timestamp: 34251,
        metadata: {}
      }
    });
    const netCheckpoint2 = cleanupMutableData(createNetCheckpoint(), 539);
    const checkpoint2 = appendToCheckpoint(checkpoint, "network525", netCheckpoint2);
    assert.deepEqual(checkpoint2, {
      network525: {
        timestamp: 539,
        metadata: {}
      }
    });
  });

  it("Should merge metadata maps", async () => {
    const netCheckpoint = cleanupMutableData(createNetCheckpoint({
      "key": "data",
      "key3": "data3"
    }), 34251);
    const checkpoint = appendToCheckpoint({}, "network12345", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network12345: {
        timestamp: 34251,
        metadata: {
          "key": "data",
          "key3": "data3"
        }
      }
    });
    const netCheckpoint2 = cleanupMutableData(createNetCheckpoint({
      "key": "updated data",
      "key2": "data2"
    }), 125154251);
    const checkpoint2 = appendToCheckpoint(checkpoint, "network12345", netCheckpoint2);
    assert.deepEqual(checkpoint2, {
      network12345: {
        timestamp: 125154251,
        metadata: {
          "key": "updated data",
          "key2": "data2",
          "key3": "data3"
        }
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
        timestamp: 951,
        metadata: {}
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
        timestamp: 531,
        metadata: {}
      },
      myNetworkName2: {
        timestamp: 201,
        metadata: {}
      }
    });
  });

  it("Should default to empty cp if loading nonexistent file", async () => {
    const loadedCP = loadCheckpoint("nonexistent")
    assert.deepEqual(loadedCP, {});
  });

  it("Should merge checkpoints", async () => {
    const cp1: ScriptCheckpoint = {
      network1: {
        timestamp: 1,
        metadata: {"key 1": "data 1"}}}
    const cp2: ScriptCheckpoint = {
      network2: {
        timestamp: 2,
        metadata: {"key 2": "data 2"}}}
    const cp = mergeCheckpoints(cp1, cp2);
    assert.deepEqual(cp, {
      network1: {
        timestamp: 1,
        metadata: {"key 1": "data 1"}},
      network2: {
        timestamp: 2,
        metadata: {"key 2": "data 2"}}
    });
  });

  it("Should deeply merge the checkpoints", async () => {
    const cp1: ScriptCheckpoint = {
      network1: {
        timestamp: 1,
        metadata: {"key 1": "data 1"}}}
    const cp2: ScriptCheckpoint = {
      network1: {
        timestamp: 2,
        metadata: {}}}
    const cp = mergeCheckpoints(cp1, cp2);
    assert.deepEqual(cp, {
      network1: {
        timestamp: 2,
        metadata: {"key 1": "data 1"}}
    });
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

describe("AlgobDeployer", () => {

  it("Should ensure metadata existence for network", async () => {
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"))
    assert.deepEqual(cleanupMutableData(deployer.checkpoint, 12345), {
      timestamp: 12345,
      metadata: {}});
  });

  it("Should hold metadata of a network", async () => {
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"))
    deployer.putMetadata("existent", "existent value");
    assert.isUndefined(deployer.getMetadata("nonexistent"));
    assert.equal(deployer.getMetadata("existent"), "existent value");
  });

  it("Should allow to override metadata of a network", async () => {
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"))
    deployer.putMetadata("existent", "existent value");
    deployer.putMetadata("existent", "existent value 2");
    assert.equal(deployer.getMetadata("existent"), "existent value 2");
  });

  it("Should set given data into checkpoint with timestamp", async () => {
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"))
    deployer.putMetadata("key 1", "val 1");
    deployer.putMetadata("key 2", "val 2");
    const cleanCP = cleanupMutableData(deployer.checkpoint, 12345)
    assert.deepEqual(cleanCP, {
      timestamp: 12345,
      metadata: {
        "key 1": "val 1",
        "key 2": "val 2"
      }});
  });

  it("Should append freshly loaded checkpoint values", async () => {
    const cp1: ScriptCheckpoint = {
      network1: {
        timestamp: 1,
        metadata: {"key 1": "data 1"}}}
    const cp2: ScriptCheckpoint = {
      network2: {
        timestamp: 2,
        metadata: {"key 2": "data 2"}}}
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network1"))
    deployer.appendCheckpoints(cp1);
    deployer.appendCheckpoints(cp2);
    assert.deepEqual(deployer.checkpoints, {
      network1: {
        timestamp: 1,
        metadata: {"key 1": "data 1"}},
      network2: {
        timestamp: 2,
        metadata: {"key 2": "data 2"}}
    });
  });

})

//  LocalWords:  cp
