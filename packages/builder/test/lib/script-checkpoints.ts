import { assert } from "chai";
import * as fs from "fs";

import {
  AlgobDeployerImpl,
  CheckpointDataImpl,
  loadCheckpoint,
  persistCheckpoint,
  ScriptNetCheckpointImpl,
  toCheckpointFileName,
  registerASA,
  registerASC
} from "../../src/lib/script-checkpoints";
import { ScriptCheckpoints, ScriptNetCheckpoint } from "../../src/types";
import { mkAlgobEnv } from "../helpers/params";
import { expectBuilderError } from "../helpers/errors";
import { ERRORS } from "../../src/internal/core/errors-list";

function cleanupMutableData (netCheckpoint: ScriptNetCheckpoint, n: number): ScriptNetCheckpoint {
  assert.isNotNull(netCheckpoint.timestamp);
  netCheckpoint.timestamp = n;
  return netCheckpoint;
}

describe("Checkpoint", () => {
  it("Should create a network checkpoint", async () => {
    const beforeTimestamp = +new Date();
    const netCheckpoint: ScriptNetCheckpoint = new ScriptNetCheckpointImpl();
    const afterTimestamp = +new Date();
    assert.isAtLeast(netCheckpoint.timestamp, beforeTimestamp);
    assert.isAtMost(netCheckpoint.timestamp, afterTimestamp);
    netCheckpoint.timestamp = 12345;
    assert.deepEqual(netCheckpoint, {
      timestamp: 12345,
      metadata: {},
      asa: {},
      asc: {}
    });
  });

  it("Should append to a checkpoint map", async () => {
    const cpData = new CheckpointDataImpl();
    const netCheckpoint: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 34251);
    const checkpoint = cpData.appendToCheckpoint("network213", netCheckpoint).checkpoints;
    assert.deepEqual(checkpoint, {
      network213: {
        timestamp: 34251,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
    const netCheckpoint2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 539);
    const checkpoint2 = cpData.appendToCheckpoint("network5352", netCheckpoint2);
    assert.deepEqual(cpData.checkpoints, {
      network213: {
        timestamp: 34251,
        metadata: {},
        asa: {},
        asc: {}
      },
      network5352: {
        timestamp: 539,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
  });

  it("Should replace in checkpoint map", async () => {
    const cpData = new CheckpointDataImpl();
    const netCheckpoint: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 34251);
    const checkpoint = cpData.appendToCheckpoint("network525", netCheckpoint);
    assert.deepEqual(cpData.checkpoints, {
      network525: {
        timestamp: 34251,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
    const netCheckpoint2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 539);
    const checkpoint2 = cpData.appendToCheckpoint("network525", netCheckpoint2);
    assert.deepEqual(cpData.checkpoints, {
      network525: {
        timestamp: 539,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
  });

  it("Should merge metadata maps", async () => {
    const cpData = new CheckpointDataImpl();
    const netCheckpoint: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASA(netCheckpoint, "asa1", "123")
    registerASC(netCheckpoint, "asc1", "536")
    cpData.appendToCheckpoint("network12345", netCheckpoint);
    assert.deepEqual(cpData.checkpoints, {
      network12345: {
        timestamp: 34251,
        metadata: {
          key: "data",
          key3: "data3"
        },
        asa: {"asa1": {creator: "123"}},
        asc: {"asc1": {creator: "536"}}
      }
    });
    const netCheckpoint2: ScriptNetCheckpoint = registerASA(cleanupMutableData(new ScriptNetCheckpointImpl({
      key: "updated data",
      key2: "data2"
    }), 125154251), "my asa 2", "creator");
    const checkpoint2 = cpData.appendToCheckpoint("network12345", netCheckpoint2);
    assert.deepEqual(cpData.checkpoints, {
      network12345: {
        timestamp: 125154251,
        metadata: {
          key: "updated data",
          key2: "data2",
          key3: "data3"
        },
        asa: {"asa1": {creator: "123"},
              "my asa 2": {creator: "creator"}},
        asc: {"asc1": {creator: "536"}}
      }
    });
  });

  it("Should crash if duplicate asa or asc name is detected", async () => {
    const cpData = new CheckpointDataImpl();
    const cp1: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASA(cp1, "asa1", "123")
    cpData.appendToCheckpoint("network12345", cp1)
    const cp2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 53521);
    registerASA(cp2, "asa1", "36506")
    expectBuilderError(
      () => cpData.appendToCheckpoint("network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "asa1"
    )
  });

  it("Should crash if duplicate ASC name is detected", async () => {
    const cpData = new CheckpointDataImpl();
    const cp1: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASC(cp1, "asc1", "123")
    cpData.appendToCheckpoint("network12345", cp1)
    const cp2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 53521);
    registerASC(cp2, "asc1", "36506")
    expectBuilderError(
      () => cpData.appendToCheckpoint("network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "asc1"
    )
  });

  it("Should produce a checkpoint file name from script name", async () => {
    const checkpointFileName = toCheckpointFileName("script-1.js");
    assert.equal(checkpointFileName, "artifacts/script-1.js.cp.yaml");
  });

  it("Should capture config", async () => {
    const cp = new CheckpointDataImpl().appendEnv(mkAlgobEnv("myNetworkName")).checkpoints;
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 951);
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 951,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
  });

  it("Should capture config two calls", async () => {
    const cpData = new CheckpointDataImpl();
    const cp = cpData
      .appendEnv(mkAlgobEnv("myNetworkName"))
      .appendEnv(mkAlgobEnv("myNetworkName2"))
      .checkpoints;
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 531);
    cp.myNetworkName2 = cleanupMutableData(cp.myNetworkName2, 201);
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 531,
        metadata: {},
        asa: {},
        asc: {}
      },
      myNetworkName2: {
        timestamp: 201,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
  });

  it("Should default to empty cp if loading nonexistent file", async () => {
    const loadedCP = loadCheckpoint("nonexistent");
    assert.deepEqual(loadedCP, {});
  });

  it("Should merge checkpoints", async () => {
    const cp1: ScriptCheckpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    };
    const cp2: ScriptCheckpoints = {
      network2: {
        timestamp: 2,
        metadata: { "key 2": "data 2" },
        asa: {},
        asc: {}
      }
    };
    const cp = new CheckpointDataImpl()
      .mergeCheckpoints(cp1)
      .mergeCheckpoints(cp2)
      .checkpoints;
    assert.deepEqual(cp, {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      },
      network2: {
        timestamp: 2,
        metadata: { "key 2": "data 2" },
        asa: {},
        asc: {}
      }
    });
  });

  it("Should deeply merge the checkpoints", async () => {
    const cp1: ScriptCheckpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    };
    const cp2: ScriptCheckpoints = {
      network1: {
        timestamp: 2,
        metadata: {},
        asa: {},
        asc: {}
      }
    };
    const cp = new CheckpointDataImpl()
      .mergeCheckpoints(cp1)
      .mergeCheckpoints(cp2)
      .checkpoints;
    assert.deepEqual(cp, {
      network1: {
        timestamp: 2,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    });
  });

  it("Should allow registration of an asset", async () => {
    var cp: ScriptNetCheckpointImpl = new ScriptNetCheckpointImpl();
    cp.timestamp = 12345;
    assert.deepEqual(cp as ScriptNetCheckpoint, {
      timestamp: 12345,
      metadata: {},
      asa: {},
      asc: {}
    });
    cp = registerASC(
      registerASA(
        cp,
        "My ASA",
        "ASA deployer address"),
      "My ASC", "ASC deployer address")
    assert.deepEqual(cp as ScriptNetCheckpoint, {
      timestamp: 12345,
      metadata: {},
      asa: {"My ASA": {creator: "ASA deployer address"}},
      asc: {"My ASC": {creator: "ASC deployer address"}}
    });
  });
});

describe("Checkpoint with cleanup", () => {
  afterEach(() => {
    try {
      fs.rmdirSync("artifacts", { recursive: true });
    } catch (err) {
      // ignored
    }
  });

  it("Should persist and load the checkpoint", async () => {
    const cpData = new CheckpointDataImpl();
    const origCP = cpData
      .appendToCheckpoint("network124", new ScriptNetCheckpointImpl())
      .checkpoints;
    persistCheckpoint("script-1.js", origCP);
    const loadedCP = loadCheckpoint("script-1.js");
    assert.deepEqual(loadedCP, origCP);
  });
});

describe("AlgobDeployer", () => {
  it("Should ensure metadata existence for network", async () => {
    const cpData = new CheckpointDataImpl();
    const deployer = new AlgobDeployerImpl(
      mkAlgobEnv("network 123"),
      cpData);
    assert.deepEqual(cleanupMutableData(cpData.checkpoints["network 123"], 12345), {
      timestamp: 12345,
      metadata: {},
      asa: {},
      asc: {}
    });
  });

  it("Should hold metadata of a network", async () => {
    const deployer = new AlgobDeployerImpl(
      mkAlgobEnv("network 123"),
      new CheckpointDataImpl());
    deployer.putMetadata("existent", "existent value");
    assert.isUndefined(deployer.getMetadata("nonexistent"));
    assert.equal(deployer.getMetadata("existent"), "existent value");
  });

  it("Should allow to override metadata of a network", async () => {
    const deployer = new AlgobDeployerImpl(
      mkAlgobEnv("network 123"),
      new CheckpointDataImpl());
    deployer.putMetadata("existent", "existent value");
    deployer.putMetadata("existent", "existent value 2");
    assert.equal(deployer.getMetadata("existent"), "existent value 2");
  });

  it("Should set given data into checkpoint with timestamp", async () => {
    const cpData = new CheckpointDataImpl();
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"), cpData);
    deployer.putMetadata("key 1", "val 1");
    deployer.putMetadata("key 2", "val 2");
    const cleanCP = cleanupMutableData(cpData.checkpoints["network 123"], 12345);
    assert.deepEqual(cleanCP, {
      timestamp: 12345,
      metadata: {
        "key 1": "val 1",
        "key 2": "val 2"
      },
      asa: {},
      asc: {}
    });
  });

  it("Should append freshly loaded checkpoint values", async () => {
    const cp1: ScriptCheckpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      } as ScriptNetCheckpoint
    };
    const cp2: ScriptCheckpoints = {
      network2: {
        timestamp: 2,
        metadata: { "key 2": "data 2" },
        asa: {},
        asc: {}
      } as ScriptNetCheckpoint
    };
    const cpData = new CheckpointDataImpl();
    const deployer = new AlgobDeployerImpl(
      mkAlgobEnv("network1"),
      cpData);
    cpData.mergeCheckpoints(cp1);
    cpData.mergeCheckpoints(cp2);
    assert.deepEqual(cpData.checkpoints, {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      },
      network2: {
        timestamp: 2,
        metadata: { "key 2": "data 2" },
        asa: {},
        asc: {}
      }
    });
  });

  it("Should save info to checkpoint after asset deployment", async () => {
    const cpData = new CheckpointDataImpl();
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network1"), cpData);

    const asaInfo = await deployer.deployASA("MY_ASA", "My brand new ASA", "addr-1")
    assert.deepEqual(asaInfo, { creator: "addr-1-get-address" });

    const ascInfo = await deployer.deployASC("MY_ASC", "My brand new ASC", "addr-2")
    assert.deepEqual(ascInfo, { creator: "addr-2-get-address" });

    cpData.checkpoints["network1"].timestamp = 515236
    assert.deepEqual(cpData.checkpoints, {
      "network1": {
        "asa": {
          "MY_ASA": {
            "creator": "addr-1-get-address"
          }
        },
        "asc": {
          "MY_ASC": {
            "creator": "addr-2-get-address"
          }
        },
        "metadata": {},
        "timestamp": 515236
      }
    });
  });
});

//  LocalWords:  cp
