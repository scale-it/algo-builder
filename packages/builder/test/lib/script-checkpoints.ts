import { assert } from "chai";
import * as fs from "fs";

import { ERRORS } from "../../src/internal/core/errors-list";
import {
  AlgobDeployerImpl,
  appendToCheckpoint,
  CheckpointImpl,
  CheckpointRepoImpl,
  loadCheckpoint,
  persistCheckpoint,
  registerASA,
  registerASC,
  toCheckpointFileName
} from "../../src/lib/script-checkpoints";
import { Checkpoint, Checkpoints } from "../../src/types";
import { expectBuilderError, expectBuilderErrorAsync } from "../helpers/errors";
import { mkAlgobEnv } from "../helpers/params";

function cleanupMutableData (netCheckpoint: Checkpoint, n: number): Checkpoint {
  assert.isNotNull(netCheckpoint.timestamp);
  netCheckpoint.timestamp = n;
  return netCheckpoint;
}

describe("Checkpoint", () => {
  it("Should create a network checkpoint", async () => {
    const beforeTimestamp = +new Date();
    const netCheckpoint: Checkpoint = new CheckpointImpl();
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
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(new CheckpointImpl(), 34251);
    const checkpoint = appendToCheckpoint(checkpoints, "network213", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network213: {
        timestamp: 34251,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
    const netCheckpoint2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 539);
    checkpoints = appendToCheckpoint(checkpoints, "network5352", netCheckpoint2);
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
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(new CheckpointImpl(), 34251);
    checkpoints = appendToCheckpoint(checkpoints, "network525", netCheckpoint);
    assert.deepEqual(checkpoints, {
      network525: {
        timestamp: 34251,
        metadata: {},
        asa: {},
        asc: {}
      }
    });
    const netCheckpoint2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 539);
    checkpoints = appendToCheckpoint(checkpoints, "network525", netCheckpoint2);
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
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(new CheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASA(netCheckpoint, "asa1", "123");
    registerASC(netCheckpoint, "asc1", "536");
    appendToCheckpoint(checkpoints, "network12345", netCheckpoint);
    assert.deepEqual(checkpoints, {
      network12345: {
        timestamp: 34251,
        metadata: {
          key: "data",
          key3: "data3"
        },
        asa: { asa1: { creator: "123" } },
        asc: { asc1: { creator: "536" } }
      }
    });
    const netCheckpoint2: Checkpoint = registerASA(cleanupMutableData(new CheckpointImpl({
      key: "updated data",
      key2: "data2"
    }), 125154251), "my asa 2", "creator");
    checkpoints = appendToCheckpoint(checkpoints, "network12345", netCheckpoint2);
    assert.deepEqual(checkpoints, {
      network12345: {
        timestamp: 125154251,
        metadata: {
          key: "updated data",
          key2: "data2",
          key3: "data3"
        },
        asa: {
          asa1: { creator: "123" },
          "my asa 2": { creator: "creator" }
        },
        asc: { asc1: { creator: "536" } }
      }
    });
  });

  it("Should crash if duplicate asa or asc name is detected", async () => {
    const checkpoints: Checkpoints = {};
    const cp1: Checkpoint = cleanupMutableData(new CheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASA(cp1, "asa1", "123");
    appendToCheckpoint(checkpoints, "network12345", cp1);
    const cp2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 53521);
    registerASA(cp2, "asa1", "36506");
    expectBuilderError(
      () => appendToCheckpoint(checkpoints, "network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "asa1"
    );
  });

  it("Should crash if duplicate ASC name is detected", async () => {
    const checkpoints: Checkpoints = {};
    const cp1: Checkpoint = cleanupMutableData(new CheckpointImpl({
      key: "data",
      key3: "data3"
    }), 34251);
    registerASC(cp1, "asc1", "123");
    appendToCheckpoint(checkpoints, "network12345", cp1);
    const cp2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 53521);
    registerASC(cp2, "asc1", "36506");
    expectBuilderError(
      () => appendToCheckpoint(checkpoints, "network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "asc1"
    );
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
    var cp: CheckpointImpl = new CheckpointImpl();
    cp.timestamp = 12345;
    assert.deepEqual(cp, {
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
      "My ASC", "ASC deployer address");
    assert.deepEqual(cp, {
      timestamp: 12345,
      metadata: {},
      asa: { "My ASA": { creator: "ASA deployer address" } },
      asc: { "My ASC": { creator: "ASC deployer address" } }
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
      hi: {
        timestamp: 123,
        metadata: {},
        asa: {},
        asc: {}
      }
    }, "network124", new CheckpointImpl());
    persistCheckpoint("script-1.js", origCP);
    const loadedCP = loadCheckpoint("script-1.js");
    assert.deepEqual(loadedCP, origCP);
  });

  it("Should persist empty checkpoint as empty file", async () => {
    persistCheckpoint("script-1.js", {});
    const loadedCP = loadCheckpoint("script-1.js");
    assert.deepEqual(loadedCP, {});
  });
});

describe("CheckpointRepoImpl", () => {
  it("Should allow to set metadata", async () => {
    const cp = new CheckpointRepoImpl()
      .putMetadata("myNetworkName", "key", "data")
      .precedingCP;
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 951);
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 951,
        metadata: { key: "data" },
        asa: {},
        asc: {}
      }
    });
  });

  it("Should allow to set metadata two networks", async () => {
    const cp = new CheckpointRepoImpl()
      .putMetadata("myNetworkName", "key", "data")
      .putMetadata("myNetworkName2", "key2", "data2")
      .precedingCP;
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 531);
    cp.myNetworkName2 = cleanupMutableData(cp.myNetworkName2, 201);
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 531,
        metadata: { key: "data" },
        asa: {},
        asc: {}
      },
      myNetworkName2: {
        timestamp: 201,
        metadata: { key2: "data2" },
        asa: {},
        asc: {}
      }
    });
  });

  it("Should allow placing state; one network", () => {
    const cpData = new CheckpointRepoImpl()
      .registerASA("network1", "ASA name", "ASA creator 123")
      .putMetadata("network1", "metadata key", "metadata value");
    cpData.precedingCP.network1.timestamp = 123;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        timestamp: 123,
        metadata: { "metadata key": "metadata value" },
        asa: { "ASA name": { creator: "ASA creator 123" } },
        asc: {}
      }
    });
  });

  it("Should allow placing state; two networks", () => {
    const cpData = new CheckpointRepoImpl()
      .registerASC("network1", "ASC name", "ASC creator 951")
      .putMetadata("net 0195", "1241 key", "345 value");
    cpData.precedingCP.network1.timestamp = 123;
    cpData.precedingCP["net 0195"].timestamp = 123;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        timestamp: 123,
        metadata: {},
        asa: {},
        asc: { "ASC name": { creator: "ASC creator 951" } }
      },
      "net 0195": {
        timestamp: 123,
        metadata: { "1241 key": "345 value" },
        asa: {},
        asc: {}
      }
    });
  });

  it("Should merge checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    };
    const cp2: Checkpoints = {
      network2: {
        timestamp: 2,
        metadata: { "key 2": "data 2" },
        asa: {},
        asc: {}
      }
    };
    const cp = new CheckpointRepoImpl()
      .merge(cp1)
      .merge(cp2)
      .precedingCP;
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
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    };
    const cp2: Checkpoints = {
      network1: {
        timestamp: 2,
        metadata: {},
        asa: { "asa key": { creator: "asa creator" } },
        asc: {}
      }
    };
    const cpData = new CheckpointRepoImpl()
      .merge(cp1)
      .merge(cp2);
    cpData.precedingCP.network1.timestamp = 124;
    cpData.strippedCP.network1.timestamp = 124;
    cpData.allCPs.network1.timestamp = 124;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        timestamp: 124,
        metadata: { "key 1": "data 1" },
        asa: { "asa key": { creator: "asa creator" } },
        asc: {}
      }
    });
    assert.deepEqual(cpData.strippedCP, {
      network1: {
        timestamp: 124,
        metadata: {},
        asa: { "asa key": { creator: "asa creator" } },
        asc: {}
      }
    });
    assert.deepEqual(cpData.allCPs, {
      network1: {
        timestamp: 124,
        metadata: { "key 1": "data 1" },
        asa: { "asa key": { creator: "asa creator" } },
        asc: {}
      }
    });
  });

  it("Should deeply merge global checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: { "ASA key": { creator: "ASA creator" } }
      }
    };
    const cp2: Checkpoints = {
      network1: {
        timestamp: 2,
        metadata: {},
        asa: {},
        asc: {}
      }
    };
    const cp3: Checkpoints = {
      network1: {
        timestamp: 8,
        metadata: {},
        asa: {},
        asc: { "ASC key": { creator: "ASC creator" } }
      }
    };
    const cpData = new CheckpointRepoImpl()
      .mergeToGlobal(cp1)
      .mergeToGlobal(cp2)
      .merge(cp3);
    assert.deepEqual(cpData.allCPs, {
      network1: {
        timestamp: 8,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {
          "ASA key": { creator: "ASA creator" },
          "ASC key": { creator: "ASC creator" }
        }
      }
    });
    cpData.precedingCP.network1.timestamp = 124;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        asa: {},
        asc: { "ASC key": { creator: "ASC creator" } },
        metadata: {},
        timestamp: 124
      }
    });
    cpData.strippedCP.network1.timestamp = 124;
    assert.deepEqual(cpData.strippedCP, {
      network1: {
        asa: {},
        asc: { "ASC key": { creator: "ASC creator" } },
        metadata: {},
        timestamp: 124
      }
    });
  });

  describe("CheckpointRepoImpl with sample data", () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    };
    const cp2: Checkpoints = {
      network4: {
        timestamp: 4,
        metadata: { "metadata 4 key": "metadata value" },
        asa: {},
        asc: {}
      }
    };
    const cpData = new CheckpointRepoImpl()
      .merge(cp1)
      .mergeToGlobal(cp2)
      .putMetadata("network1", "metadata key", "metadata value")
      .putMetadata("net 0195", "1241 key", "345 value")
      .registerASA("network1", "ASA name", "ASA creator 123")
      .registerASC("network1", "ASC name", "ASC creator 951");
    cpData.allCPs.network1.timestamp = 1111;
    cpData.allCPs.network4.timestamp = 4;
    cpData.allCPs["net 0195"].timestamp = 195;

    cpData.precedingCP.network1.timestamp = 1111;
    assert.isUndefined(cpData.precedingCP.network4);
    cpData.precedingCP["net 0195"].timestamp = 195;

    cpData.strippedCP.network1.timestamp = 1111;
    assert.isUndefined(cpData.strippedCP.network4);
    cpData.strippedCP["net 0195"].timestamp = 195;

    it("Should contain factory methods for ASA anc ASC asset registration", () => {
      assert.deepEqual(cpData.allCPs, {
        network1: {
          timestamp: 1111,
          metadata: {
            "key 1": "data 1",
            "metadata key": "metadata value"
          },
          asa: { "ASA name": { creator: "ASA creator 123" } },
          asc: { "ASC name": { creator: "ASC creator 951" } }
        },
        network4: {
          timestamp: 4,
          metadata: { "metadata 4 key": "metadata value" },
          asa: {},
          asc: {}
        },
        "net 0195": {
          timestamp: 195,
          metadata: { "1241 key": "345 value" },
          asa: {},
          asc: {}
        }
      });
      assert.deepEqual(cpData.precedingCP, {
        network1: {
          timestamp: 1111,
          metadata: {
            "key 1": "data 1",
            "metadata key": "metadata value"
          },
          asa: { "ASA name": { creator: "ASA creator 123" } },
          asc: { "ASC name": { creator: "ASC creator 951" } }
        },
        "net 0195": {
          timestamp: 195,
          metadata: { "1241 key": "345 value" },
          asa: {},
          asc: {}
        }
      });
      assert.deepEqual(cpData.strippedCP, {
        network1: {
          timestamp: 1111,
          metadata: {
            "key 1": "data 1",
            "metadata key": "metadata value"
          },
          asa: { "ASA name": { creator: "ASA creator 123" } },
          asc: { "ASC name": { creator: "ASC creator 951" } }
        },
        "net 0195": {
          timestamp: 195,
          metadata: { "1241 key": "345 value" },
          asa: {},
          asc: {}
        }
      });
    });

    it("Should return metadata for specified network", () => {
      assert.equal(cpData.getMetadata("network1", "hi"), undefined);
      assert.equal(cpData.getMetadata("network1", "metadata key"), "metadata value");
      assert.equal(cpData.getMetadata("network4", "metadata key"), undefined);
    });
  });

  it("isDefined should return true regardless of the asset type", () => {
    const cpData = new CheckpointRepoImpl();
    assert.isFalse(cpData.isDefined("network1", "ASA name"));
    assert.isFalse(cpData.isDefined("network1", "ASC name"));
    cpData.registerASA("network1", "ASA name", "ASA creator 123")
      .registerASC("network1", "ASC name", "ASC creator 951");
    assert.isTrue(cpData.isDefined("network1", "ASA name"));
    assert.isTrue(cpData.isDefined("network1", "ASC name"));
    assert.isFalse(cpData.isDefined("network1", "other name"));
    assert.isFalse(cpData.isDefined("other network", "ASA name"));
    assert.isFalse(cpData.isDefined("other network", "ASC name"));
  });
});

describe("AlgobDeployerImpl", () => {
  it("Should ensure metadata existence for network", async () => {
    const cpData = new CheckpointRepoImpl().putMetadata("network 123", "k", "v");
    assert.deepEqual(cleanupMutableData(cpData.precedingCP["network 123"], 12345), {
      timestamp: 12345,
      metadata: { k: "v" },
      asa: {},
      asc: {}
    });
  });

  it("Should hold metadata of a network", async () => {
    const env = mkAlgobEnv("network 123");
    const deployer = new AlgobDeployerImpl(env, new CheckpointRepoImpl());
    deployer.putMetadata("existent", "existent value");
    assert.isUndefined(deployer.getMetadata("nonexistent"));
    assert.equal(deployer.getMetadata("existent"), "existent value");
  });

  it("Should set given data into checkpoint with timestamp", async () => {
    const env = mkAlgobEnv("network 123");
    const cpData = new CheckpointRepoImpl();
    const deployer = new AlgobDeployerImpl(env, cpData);
    deployer.putMetadata("key 1", "val 1");
    deployer.putMetadata("key 2", "val 2");
    const cleanCP = cleanupMutableData(cpData.precedingCP["network 123"], 12345);
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
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: { "key 1": "data 1" },
        asa: {},
        asc: {}
      }
    };
    const cp2: Checkpoints = {
      network2: {
        timestamp: 2,
        metadata: { "key 2": "data 2" },
        asa: {},
        asc: {}
      }
    };
    const cpData = new CheckpointRepoImpl();
    cpData.merge(cp1);
    cpData.merge(cp2);
    assert.deepEqual(cpData.precedingCP, {
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
    const env = mkAlgobEnv("network1");
    const cpData = new CheckpointRepoImpl();
    const deployer = new AlgobDeployerImpl(env, cpData);

    const asaInfo = await deployer.deployASA("MY_ASA", "My brand new ASA", "addr-1");
    assert.deepEqual(asaInfo, { creator: "addr-1-get-address" });

    const ascInfo = await deployer.deployASC("MY_ASC", "My brand new ASC", "addr-2");
    assert.deepEqual(ascInfo, { creator: "addr-2-get-address" });

    cpData.precedingCP.network1.timestamp = 515236;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        asa: {
          MY_ASA: {
            creator: "addr-1-get-address"
          }
        },
        asc: {
          MY_ASC: {
            creator: "addr-2-get-address"
          }
        },
        metadata: {},
        timestamp: 515236
      }
    });
  });

  it("Should use getMetadata and isDefined from CheckpointData", async () => {
    const networkName = "network1";
    const env = mkAlgobEnv(networkName);
    const cpData = new CheckpointRepoImpl()
      .registerASA(networkName, "ASA name", "ASA creator 123")
      .registerASC(networkName, "ASC name", "ASC creator 951")
      .putMetadata(networkName, "k", "v");
    const deployer = new AlgobDeployerImpl(env, cpData);
    assert.isTrue(deployer.isDefined("ASC name"));
    assert.equal(deployer.getMetadata("k"), "v");
  });

  it("Should ignore same metadata of the same network", async () => {
    const env = mkAlgobEnv("network 123");
    const deployer = new AlgobDeployerImpl(env, new CheckpointRepoImpl());
    deployer.putMetadata("existent", "existent value");
    deployer.putMetadata("existent", "existent value");
    assert.equal(deployer.getMetadata("existent"), "existent value");
  });

  it("Should crash when same metadata key is set second time & different value", async () => {
    const cpData = new CheckpointRepoImpl();
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"), cpData);
    deployer.putMetadata("metadata_key", "orig_value");
    expectBuilderError(
      () => deployer.putMetadata("metadata_key", "new_value"),
      ERRORS.BUILTIN_TASKS.DEPLOYER_METADATA_ALREADY_PRESENT,
      "metadata_key"
    );
  });

  it("Should crash when same ASA name is tried to deploy to second time", async () => {
    const cpData = new CheckpointRepoImpl();
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"), cpData);
    await deployer.deployASA("ASA_key", "orig_value", "deployer");
    await expectBuilderErrorAsync(
      async () => await deployer.deployASA("ASA_key", "new_value", "deployer"),
      ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT,
      "ASA_key"
    );
  });

  it("Should crash when same ASC name is tried to deploy to second time", async () => {
    const cpData = new CheckpointRepoImpl();
    const deployer = new AlgobDeployerImpl(mkAlgobEnv("network 123"), cpData);
    await deployer.deployASC("ASC_key", "orig_value", "deployer");
    await expectBuilderErrorAsync(
      async () => await deployer.deployASC("ASC_key", "new_value", "deployer"),
      ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT,
      "ASC_key"
    );
  });
});

//  LocalWords:  cp
