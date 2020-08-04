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
  registerASC,
  appendToCheckpoint
} from "../../src/lib/script-checkpoints";
import { ScriptCheckpoints, ScriptNetCheckpoint, CheckpointData } from "../../src/types";
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
    const checkpoints: ScriptCheckpoints = {};
    const netCheckpoint: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 34251);
    const checkpoint = appendToCheckpoint(checkpoints, "network213", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network213: {
        timestamp: 34251,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
    const netCheckpoint2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 539);
    const checkpoint2 = appendToCheckpoint(checkpoints, "network5352", netCheckpoint2);
    assert.deepEqual(checkpoints, {
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
    const checkpoints: ScriptCheckpoints = {};
    const netCheckpoint: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 34251);
    const checkpoint = appendToCheckpoint(checkpoints, "network525", netCheckpoint);
    assert.deepEqual(checkpoints, {
      network525: {
        timestamp: 34251,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
    const netCheckpoint2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 539);
    const checkpoint2 = appendToCheckpoint(checkpoints, "network525", netCheckpoint2);
    assert.deepEqual(checkpoints, {
      network525: {
        timestamp: 539,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
  });

  it("Should merge metadata maps", async () => {
    const checkpoints: ScriptCheckpoints = {};
    const netCheckpoint: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASA(netCheckpoint, "asa1", "123")
    registerASC(netCheckpoint, "asc1", "536")
    appendToCheckpoint(checkpoints, "network12345", netCheckpoint);
    assert.deepEqual(checkpoints, {
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
    const checkpoint2 = appendToCheckpoint(checkpoints, "network12345", netCheckpoint2);
    assert.deepEqual(checkpoints, {
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
    const checkpoints: ScriptCheckpoints = {};
    const cp1: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASA(cp1, "asa1", "123")
    appendToCheckpoint(checkpoints, "network12345", cp1)
    const cp2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 53521);
    registerASA(cp2, "asa1", "36506")
    expectBuilderError(
      () => appendToCheckpoint(checkpoints, "network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "asa1"
    )
  });

  it("Should crash if duplicate ASC name is detected", async () => {
    const checkpoints: ScriptCheckpoints = {};
    const cp1: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASC(cp1, "asc1", "123")
    appendToCheckpoint(checkpoints, "network12345", cp1)
    const cp2: ScriptNetCheckpoint = cleanupMutableData(new ScriptNetCheckpointImpl(), 53521);
    registerASC(cp2, "asc1", "36506")
    expectBuilderError(
      () => appendToCheckpoint(checkpoints, "network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "asc1"
    )
  });

  it("Should produce a checkpoint file name from script name", async () => {
    const checkpointFileName = toCheckpointFileName("script-1.js");
    assert.equal(checkpointFileName, "artifacts/script-1.js.cp.yaml");
  });


  it("Should default to empty cp if loading nonexistent file", async () => {
    const loadedCP = loadCheckpoint("nonexistent");
    assert.deepEqual(loadedCP, {});
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
    const origCP = appendToCheckpoint({
      "hi": {
        timestamp: 123,
        metadata: {},
        asa: {},
        asc: {}
      }
    }, "network124", new ScriptNetCheckpointImpl());
    persistCheckpoint("script-1.js", origCP);
    const loadedCP = loadCheckpoint("script-1.js");
    assert.deepEqual(loadedCP, origCP);
  });

  it("Should persist empty checkpoint as empty file", async () => {
    const cpData = new CheckpointDataImpl();
    persistCheckpoint("script-1.js", {});
    const loadedCP = loadCheckpoint("script-1.js");
    assert.deepEqual(loadedCP, {});
  });
});

describe("CheckpointDataImpl", () => {
  it("Should allow to set metadata", async () => {
    const cp = new CheckpointDataImpl()
      .putMetadata("myNetworkName", "key", "data")
      .visibleCP
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 951);
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 951,
        metadata: {"key": "data"},
        asa: {},
        asc: {}
      }
    });
  });

  it("Should allow to set metadata two networks", async () => {
    const cpData = new CheckpointDataImpl();
    const cp = cpData
      .putMetadata("myNetworkName", "key", "data")
      .putMetadata("myNetworkName2", "key2", "data2")
      .visibleCP;
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 531);
    cp.myNetworkName2 = cleanupMutableData(cp.myNetworkName2, 201);
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 531,
        metadata: {"key": "data"},
        asa: {},
        asc: {}
      },
      myNetworkName2: {
        timestamp: 201,
        metadata: {"key2": "data2"},
        asa: {},
        asc: {}
      }
    });
  });

  it("Should allow placing state; one network", () => {
    const cpData = new CheckpointDataImpl()
      .registerASA("network1", "ASA name", "ASA creator 123")
      .putMetadata("network1", "metadata key", "metadata value")
    cpData.visibleCP.network1.timestamp = 123
    assert.deepEqual(cpData.visibleCP as ScriptCheckpoints, {
      network1: {
        timestamp: 123,
        metadata: {"metadata key": "metadata value"},
        asa: {"ASA name": { creator: "ASA creator 123" }},
        asc: {}
      }
    });
  })

  it("Should allow placing state; two networks", () => {
    const cpData = new CheckpointDataImpl()
      .registerASC("network1", "ASC name", "ASC creator 951")
      .putMetadata("net 0195", "1241 key", "345 value")
    cpData.visibleCP.network1.timestamp = 123
    cpData.visibleCP["net 0195"].timestamp = 123
    assert.deepEqual(cpData.visibleCP as ScriptCheckpoints, {
      network1: {
        timestamp: 123,
        metadata: {},
        asa: {},
        asc: {"ASC name": { creator: "ASC creator 951" }}
      },
      "net 0195": {
        timestamp: 123,
        metadata: {"1241 key": "345 value"},
        asa: {},
        asc: {}
      }
    });
  })

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
      .merge(cp1)
      .merge(cp2)
      .visibleCP;
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
        asa: { "asa key": { creator : "asa creator" } },
        asc: {}
      }
    };
    const cpData = new CheckpointDataImpl()
      .merge(cp1)
      .merge(cp2)
    cpData.visibleCP.network1.timestamp = 124
    cpData.strippedCP.network1.timestamp = 124
    cpData.globalCP.network1.timestamp = 124
    assert.deepEqual(cpData.visibleCP, {
      network1: {
        timestamp: 124,
        metadata: { "key 1": "data 1" },
        asa: { "asa key": { creator : "asa creator" } },
        asc: {}
      }
    });
    assert.deepEqual(cpData.strippedCP, {
      network1: {
        timestamp: 124,
        metadata: {},
        asa: { "asa key": { creator : "asa creator" } },
        asc: {}
      }
    });
    assert.deepEqual(cpData.globalCP, {
      network1: {
        timestamp: 124,
        metadata: { "key 1": "data 1" },
        asa: { "asa key": { creator : "asa creator" } },
        asc: {}
      }
    });
  });

  it("Should deeply merge global checkpoints", async () => {
    const cp1: ScriptCheckpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: { "ASA key": { creator : "ASA creator" } }
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
    const cp3: ScriptCheckpoints = {
      network1: {
        timestamp: 8,
        metadata: {},
        asa: {},
        asc: {"ASC key": { creator : "ASC creator" }}
      }
    };
    const cpData = new CheckpointDataImpl()
      .mergeToGlobal(cp1)
      .mergeToGlobal(cp2)
      .merge(cp3)
    assert.deepEqual(cpData.globalCP, {
      network1: {
        timestamp: 8,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {
          "ASA key": { creator : "ASA creator" },
          "ASC key": { creator : "ASC creator" }
        }
      }
    });
    cpData.visibleCP.network1.timestamp = 124
    assert.deepEqual(cpData.visibleCP, {
      "network1": {
        "asa": {},
        "asc": {"ASC key": { creator : "ASC creator" }},
        "metadata": {},
        "timestamp": 124
      }
    });
    cpData.strippedCP.network1.timestamp = 124
    assert.deepEqual(cpData.strippedCP, {
      "network1": {
        "asa": {},
        "asc": {"ASC key": { creator : "ASC creator" }},
        "metadata": {},
        "timestamp": 124
      }
    });
  });

  describe("CheckpointDataImpl with sample data", () => {
    const cp1: ScriptCheckpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    };
    const cp2: ScriptCheckpoints = {
      network4: {
        timestamp: 4,
        metadata: {"metadata 4 key": "metadata value"},
        asa: {},
        asc: {}
      }
    };
    const cpData = new CheckpointDataImpl()
      .merge(cp1)
      .mergeToGlobal(cp2)
      .putMetadata("network1", "metadata key", "metadata value")
      .putMetadata("net 0195", "1241 key", "345 value")
      .registerASA("network1", "ASA name", "ASA creator 123")
      .registerASC("network1", "ASC name", "ASC creator 951")
    cpData.globalCP.network1.timestamp = 1111
    cpData.globalCP.network4.timestamp = 4
    cpData.globalCP["net 0195"].timestamp = 195

    cpData.visibleCP.network1.timestamp = 1111
    assert.isUndefined(cpData.visibleCP.network4)
    cpData.visibleCP["net 0195"].timestamp = 195

    cpData.strippedCP.network1.timestamp = 1111
    assert.isUndefined(cpData.strippedCP.network4)
    cpData.strippedCP["net 0195"].timestamp = 195

    it("Should contain factory methods for ASA anc ASC asset registration", () => {
      assert.deepEqual(cpData.globalCP, {
        network1: {
          timestamp: 1111,
          metadata: { "key 1": "data 1",
                      "metadata key": "metadata value" },
          asa: {"ASA name": { creator : "ASA creator 123" }},
          asc: {"ASC name": { creator : "ASC creator 951" }}
        },
        network4: {
          timestamp: 4,
          metadata: {"metadata 4 key": "metadata value"},
          asa: {},
          asc: {}
        },
        "net 0195": {
          timestamp: 195,
          metadata: {"1241 key": "345 value"},
          asa: {},
          asc: {}
        }
      });
      assert.deepEqual(cpData.visibleCP, {
        network1: {
          timestamp: 1111,
          metadata: { "key 1": "data 1" ,
                      "metadata key": "metadata value" },
          asa: {"ASA name": { creator : "ASA creator 123" }},
          asc: {"ASC name": { creator : "ASC creator 951" }}
        },
        "net 0195": {
          timestamp: 195,
          metadata: {"1241 key": "345 value"},
          asa: {},
          asc: {}
        }
      });
      assert.deepEqual(cpData.strippedCP, {
        network1: {
          timestamp: 1111,
          metadata: { "key 1": "data 1",
                      "metadata key": "metadata value" },
          asa: {"ASA name": { creator : "ASA creator 123" }},
          asc: {"ASC name": { creator : "ASC creator 951" }}
        },
        "net 0195": {
          timestamp: 195,
          metadata: {"1241 key": "345 value"},
          asa: {},
          asc: {}
        }
      });
    })

    it("Should return metadata for specified network", () => {
      assert.equal(cpData.getMetadata("network1", "hi"), undefined);
      assert.equal(cpData.getMetadata("network1", "metadata key"), "metadata value");
      assert.equal(cpData.getMetadata("network4", "metadata key"), undefined);
    })

  });

  it("isDefined should return true regardless of the asset type", () => {
    const cpData = new CheckpointDataImpl()
    assert.isFalse(cpData.isDefined("network1", "ASA name"))
    assert.isFalse(cpData.isDefined("network1", "ASC name"))
    cpData.registerASA("network1", "ASA name", "ASA creator 123")
      .registerASC("network1", "ASC name", "ASC creator 951")
    assert.isTrue(cpData.isDefined("network1", "ASA name"))
    assert.isTrue(cpData.isDefined("network1", "ASC name"))
    assert.isFalse(cpData.isDefined("network1", "other name"))
    assert.isFalse(cpData.isDefined("other network", "ASA name"))
    assert.isFalse(cpData.isDefined("other network", "ASC name"))
  })

})

describe("AlgobDeployer", () => {
  it("Should ensure metadata existence for network", async () => {
    const cpData = new CheckpointDataImpl().putMetadata("network 123", "k", "v");
    const deployer = new AlgobDeployerImpl(
      mkAlgobEnv("network 123"),
      cpData);
    assert.deepEqual(cleanupMutableData(cpData.visibleCP["network 123"], 12345), {
      timestamp: 12345,
      metadata: {"k": "v"},
      asa: {},
      asc: {}
    });
  });

  it("Should hold metadata of a network", async () => {
    const env = mkAlgobEnv("network 123")
    const deployer = new AlgobDeployerImpl(env, new CheckpointDataImpl());
    deployer.putMetadata("existent", "existent value");
    assert.isUndefined(deployer.getMetadata("nonexistent"));
    assert.equal(deployer.getMetadata("existent"), "existent value");
  });

  it("Should allow to override metadata of a network", async () => {
    const env = mkAlgobEnv("network 123")
    const deployer = new AlgobDeployerImpl(env, new CheckpointDataImpl());
    deployer.putMetadata("existent", "existent value");
    deployer.putMetadata("existent", "existent value 2");
    assert.equal(deployer.getMetadata("existent"), "existent value 2");
  });

  it("Should set given data into checkpoint with timestamp", async () => {
    const env = mkAlgobEnv("network 123")
    const cpData = new CheckpointDataImpl();
    const deployer = new AlgobDeployerImpl(env, cpData);
    deployer.putMetadata("key 1", "val 1");
    deployer.putMetadata("key 2", "val 2");
    const cleanCP = cleanupMutableData(cpData.visibleCP["network 123"], 12345);
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
    cpData.merge(cp1);
    cpData.merge(cp2);
    assert.deepEqual(cpData.visibleCP, {
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
    const env = mkAlgobEnv("network1")
    const cpData = new CheckpointDataImpl();
    const deployer = new AlgobDeployerImpl(env, cpData);

    const asaInfo = await deployer.deployASA("MY_ASA", "My brand new ASA", "addr-1")
    assert.deepEqual(asaInfo, { creator: "addr-1-get-address" });

    const ascInfo = await deployer.deployASC("MY_ASC", "My brand new ASC", "addr-2")
    assert.deepEqual(ascInfo, { creator: "addr-2-get-address" });

    cpData.visibleCP["network1"].timestamp = 515236
    assert.deepEqual(cpData.visibleCP, {
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

  it("Should use getMetadata and isDefined from CheckpointData", async () => {
    const networkName = "network1"
    const env = mkAlgobEnv(networkName)
    const cpData = new CheckpointDataImpl()
      .registerASA(networkName, "ASA name", "ASA creator 123")
      .registerASC(networkName, "ASC name", "ASC creator 951")
      .putMetadata(networkName, "k", "v")
    const deployer = new AlgobDeployerImpl(env, cpData);
    assert.isTrue(deployer.isDefined("ASC name"))
    assert.equal(deployer.getMetadata("k"), "v")
  });
});

//  LocalWords:  cp
