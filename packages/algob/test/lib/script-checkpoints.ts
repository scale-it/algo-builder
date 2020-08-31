import { assert } from "chai";
import * as fs from "fs";

import { ERRORS } from "../../src/internal/core/errors-list";
import {
  appendToCheckpoint,
  CheckpointImpl,
  CheckpointRepoImpl,
  loadCheckpoint,
  persistCheckpoint,
  registerASA,
  registerASC,
  toCheckpointFileName,
  toScriptFileName
} from "../../src/lib/script-checkpoints";
import { ASAInfo, ASCInfo, Checkpoint, Checkpoints } from "../../src/types";
import { expectBuilderError } from "../helpers/errors";

export function cleanupMutableData (netCheckpoint: Checkpoint, n: number): Checkpoint {
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
      metadata: new Map<string, string>(),
      asa: new Map<string, ASAInfo>(),
      asc: new Map<string, ASCInfo>()
    });
  });

  it("Should append to a checkpoint map", async () => {
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(new CheckpointImpl(), 34251);
    const checkpoint = appendToCheckpoint(checkpoints, "network213", netCheckpoint);
    assert.deepEqual(checkpoint, {
      network213: {
        timestamp: 34251,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    });
    const netCheckpoint2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 539);
    checkpoints = appendToCheckpoint(checkpoints, "network5352", netCheckpoint2);
    assert.deepEqual(checkpoints, {
      network213: {
        timestamp: 34251,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      },
      network5352: {
        timestamp: 539,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
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
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    });
    const netCheckpoint2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 539);
    checkpoints = appendToCheckpoint(checkpoints, "network525", netCheckpoint2);
    assert.deepEqual(checkpoints, {
      network525: {
        timestamp: 539,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    });
  });

  it("Should merge metadata maps", async () => {
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(
      new CheckpointImpl(new Map([["key", "data"],
        ["key3", "data3"]])), 34251);
    registerASA(netCheckpoint, "asa1", {
      creator: "123",
      txId: "",
      assetIndex: 0,
      confirmedRound: 0
    });
    registerASC(netCheckpoint, "asc1", {
      creator: "536",
      txId: "",
      confirmedRound: 0,
      contractAddress: "addr-3",
      logicSignature: "sig-1"
    });
    appendToCheckpoint(checkpoints, "network12345", netCheckpoint);
    assert.deepEqual(checkpoints, {
      network12345: {
        timestamp: 34251,
        metadata: new Map([["key", "data"],
          ["key3", "data3"]]),
        asa: new Map([["asa1", {
          creator: "123",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }]]),
        asc: new Map([["asc1", {
          creator: "536",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }]])
      }
    });
    const netCheckpoint2: Checkpoint = registerASA(
      cleanupMutableData(
        new CheckpointImpl(new Map([["key", "updated data"],
          ["key2", "data2"]])),
        125154251),
      "my asa 2", {
        creator: "creator",
        txId: "",
        assetIndex: 0,
        confirmedRound: 0
      });
    checkpoints = appendToCheckpoint(checkpoints, "network12345", netCheckpoint2);
    assert.deepEqual(checkpoints, {
      network12345: {
        timestamp: 125154251,
        metadata: new Map([["key", "updated data"],
          ["key2", "data2"],
          ["key3", "data3"]]),
        asa: new Map([
          ["asa1", {
            creator: "123",
            txId: "",
            assetIndex: 0,
            confirmedRound: 0
          }],
          ["my asa 2", {
            creator: "creator",
            txId: "",
            assetIndex: 0,
            confirmedRound: 0
          }]]),
        asc: new Map([["asc1", {
          creator: "536",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }]])
      }
    });
  });

  it("Should crash if duplicate asa or asc name is detected", async () => {
    const checkpoints: Checkpoints = {};
    const cp1: Checkpoint = cleanupMutableData(
      new CheckpointImpl(new Map([["key", "data"],
        ["key3", "data3"]])),
      34251);
    registerASA(cp1, "asa1", {
      creator: "123",
      txId: "",
      assetIndex: 0,
      confirmedRound: 0
    });
    appendToCheckpoint(checkpoints, "network12345", cp1);
    const cp2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 53521);
    registerASA(cp2, "asa1", {
      creator: "36506",
      txId: "",
      assetIndex: 0,
      confirmedRound: 0
    });
    expectBuilderError(
      () => appendToCheckpoint(checkpoints, "network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "asa1"
    );
  });

  it("Should crash if duplicate ASC name is detected", async () => {
    const checkpoints: Checkpoints = {};
    const cp1: Checkpoint = cleanupMutableData(
      new CheckpointImpl(new Map([["key", "data"],
        ["key3", "data3"]])), 34251);
    registerASC(cp1, "asc1", {
      creator: "123",
      txId: "",
      confirmedRound: 0,
      contractAddress: "addr-3",
      logicSignature: "sig-1"
    });
    appendToCheckpoint(checkpoints, "network12345", cp1);
    const cp2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 53521);
    registerASC(cp2, "asc1", {
      creator: "36506",
      txId: "",
      confirmedRound: 0,
      contractAddress: "addr-3",
      logicSignature: "sig-1"
    });
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

  it("Should produce a script file name from checkpoint name", async () => {
    const checkpointFileName = toScriptFileName("artifacts/script-1.js.cp.yaml.hi.cp.yaml");
    assert.equal(checkpointFileName, "script-1.js.cp.yaml.hi");
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
      metadata: new Map<string, string>(),
      asa: new Map<string, ASAInfo>(),
      asc: new Map<string, ASCInfo>()
    });
    cp = registerASC(
      registerASA(
        cp,
        "My ASA",
        {
          creator: "ASA deployer address",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }),
      "My ASC",
      {
        creator: "ASC deployer address",
        txId: "",
        confirmedRound: 0,
        contractAddress: "addr-3",
        logicSignature: "sig-1"
      });
    assert.deepEqual(cp, {
      timestamp: 12345,
      metadata: new Map<string, string>(),
      asa: new Map([["My ASA", {
        creator: "ASA deployer address",
        txId: "",
        assetIndex: 0,
        confirmedRound: 0
      }]]),
      asc: new Map([["My ASC", {
        creator: "ASC deployer address",
        txId: "",
        confirmedRound: 0,
        contractAddress: "addr-3",
        logicSignature: "sig-1"
      }]])
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
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
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
  it('Should crash if duplication is detected between scripts', async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map([["ASA name", {
          creator: "ASA creator 123",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }]]),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cp2: Checkpoints = {
      network2: {
        timestamp: 2,
        metadata: new Map([["key 2", "data 2"]]),
        asa: new Map([["ASA name", {
          creator: "ASA creator 123",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }]]),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cp = new CheckpointRepoImpl()
      .merge(cp1, "script1");
    expectBuilderError(
      () => cp.merge(cp2, "script2"),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "script1,script2"
    );
  });

  it("Should allow to set metadata", async () => {
    const cp = new CheckpointRepoImpl()
      .putMetadata("myNetworkName", "key", "data")
      .precedingCP;
    assert.isNotNull(cp.myNetworkName);
    cp.myNetworkName = cleanupMutableData(cp.myNetworkName, 951);
    assert.deepEqual(cp, {
      myNetworkName: {
        timestamp: 951,
        metadata: new Map([["key", "data"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
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
        metadata: new Map([["key", "data"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      },
      myNetworkName2: {
        timestamp: 201,
        metadata: new Map([["key2", "data2"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    });
  });

  it("Should allow placing state; one network", () => {
    const cpData = new CheckpointRepoImpl()
      .registerASA("network1", "ASA name", {
        creator: "ASA creator 123",
        txId: "",
        assetIndex: 0,
        confirmedRound: 0
      })
      .putMetadata("network1", "metadata key", "metadata value");
    cpData.precedingCP.network1.timestamp = 123;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        timestamp: 123,
        metadata: new Map([["metadata key", "metadata value"]]),
        asa: new Map([["ASA name", {
          creator: "ASA creator 123",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }]]),
        asc: new Map<string, ASCInfo>()
      }
    });
  });

  it("Should allow placing state; two networks", () => {
    const cpData = new CheckpointRepoImpl()
      .registerASC("network1", "ASC name", {
        creator: "ASC creator 951",
        txId: "",
        confirmedRound: 0,
        contractAddress: "addr-3",
        logicSignature: "sig-1"
      })
      .putMetadata("net 0195", "1241 key", "345 value");
    cpData.precedingCP.network1.timestamp = 123;
    cpData.precedingCP["net 0195"].timestamp = 123;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        timestamp: 123,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map([["ASC name", {
          creator: "ASC creator 951",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }]])
      },
      "net 0195": {
        timestamp: 123,
        metadata: new Map([["1241 key", "345 value"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    });
  });

  it("Should merge checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cp2: Checkpoints = {
      network2: {
        timestamp: 2,
        metadata: new Map([["key 2", "data 2"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cp = new CheckpointRepoImpl()
      .merge(cp1, "12")
      .merge(cp2, "34")
      .precedingCP;
    assert.deepEqual(cp, {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      },
      network2: {
        timestamp: 2,
        metadata: new Map([["key 2", "data 2"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    });
  });

  it("Should deeply merge the checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cp2: Checkpoints = {
      network1: {
        timestamp: 2,
        metadata: new Map<string, string>(),
        asa: new Map([["asa key", {
          creator: "asa creator",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }]]),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cpData = new CheckpointRepoImpl()
      .merge(cp1, "12")
      .merge(cp2, "34");
    cpData.precedingCP.network1.timestamp = 124;
    cpData.strippedCP.network1.timestamp = 124;
    cpData.allCPs.network1.timestamp = 124;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        timestamp: 124,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map([["asa key", {
          creator: "asa creator",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }]]),
        asc: new Map<string, ASCInfo>()
      }
    });
    assert.deepEqual(cpData.strippedCP, {
      network1: {
        timestamp: 124,
        metadata: new Map<string, string>(),
        asa: new Map([["asa key", {
          creator: "asa creator",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }
        ]]),
        asc: new Map<string, ASCInfo>()
      }
    });
    assert.deepEqual(cpData.allCPs, {
      network1: {
        timestamp: 124,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map([["asa key", {
          creator: "asa creator",
          txId: "",
          assetIndex: 0,
          confirmedRound: 0
        }]]),
        asc: new Map<string, ASCInfo>()
      }
    });
  });

  it("Should deeply merge global checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map([["ASC key1", {
          creator: "ASC creator1",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }
        ]])
      }
    };
    const cp2: Checkpoints = {
      network1: {
        timestamp: 2,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cp3: Checkpoints = {
      network1: {
        timestamp: 8,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        asc: new Map([["ASC key", {
          creator: "ASC creator",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }
        ]])
      }
    };
    const cpData = new CheckpointRepoImpl()
      .mergeToGlobal(cp1, "12")
      .mergeToGlobal(cp2, "23")
      .merge(cp3, "34");
    assert.deepEqual(cpData.allCPs, {
      network1: {
        timestamp: 8,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map([["ASC key", {
          creator: "ASC creator",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }],
        ["ASC key1", {
          creator: "ASC creator1",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }]])
      }
    });
    cpData.precedingCP.network1.timestamp = 124;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        asa: new Map<string, ASAInfo>(),
        asc: new Map([["ASC key", {
          creator: "ASC creator",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }]]),
        metadata: new Map<string, string>(),
        timestamp: 124
      }
    });
    cpData.strippedCP.network1.timestamp = 124;
    assert.deepEqual(cpData.strippedCP, {
      network1: {
        asa: new Map<string, ASAInfo>(),
        asc: new Map([["ASC key", {
          creator: "ASC creator",
          txId: "",
          confirmedRound: 0,
          contractAddress: "addr-3",
          logicSignature: "sig-1"
        }]]),
        metadata: new Map<string, string>(),
        timestamp: 124
      }
    });
  });

  describe("CheckpointRepoImpl with sample data", () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cp2: Checkpoints = {
      network4: {
        timestamp: 4,
        metadata: new Map([["metadata 4 key", "metadata value"]]),
        asa: new Map<string, ASAInfo>(),
        asc: new Map<string, ASCInfo>()
      }
    };
    const cpData = new CheckpointRepoImpl()
      .merge(cp1, "12")
      .mergeToGlobal(cp2, "23")
      .putMetadata("network1", "metadata key", "metadata value")
      .putMetadata("net 0195", "1241 key", "345 value")
      .registerASA("network1", "ASA name", {
        creator: "ASA creator 123",
        txId: "",
        assetIndex: 0,
        confirmedRound: 0
      })
      .registerASC("network1", "ASC name", {
        creator: "ASC creator 951",
        txId: "",
        confirmedRound: 0,
        contractAddress: "addr-3",
        logicSignature: "sig-1"
      });
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
          metadata: new Map([["key 1", "data 1"],
            ["metadata key", "metadata value"]]),
          asa: new Map([["ASA name", {
            creator: "ASA creator 123",
            txId: "",
            assetIndex: 0,
            confirmedRound: 0
          }
          ]]),
          asc: new Map([["ASC name", {
            creator: "ASC creator 951",
            txId: "",
            confirmedRound: 0,
            contractAddress: "addr-3",
            logicSignature: "sig-1"
          }
          ]])
        },
        network4: {
          timestamp: 4,
          metadata: new Map([["metadata 4 key", "metadata value"]]),
          asa: new Map<string, ASAInfo>(),
          asc: new Map<string, ASCInfo>()
        },
        "net 0195": {
          timestamp: 195,
          metadata: new Map([["1241 key", "345 value"]]),
          asa: new Map<string, ASAInfo>(),
          asc: new Map<string, ASCInfo>()
        }
      });
      assert.deepEqual(cpData.precedingCP, {
        network1: {
          timestamp: 1111,
          metadata: new Map([["key 1", "data 1"],
            ["metadata key", "metadata value"]]),
          asa: new Map([["ASA name", {
            creator: "ASA creator 123",
            txId: "",
            assetIndex: 0,
            confirmedRound: 0
          }]]),
          asc: new Map([["ASC name", {
            creator: "ASC creator 951",
            txId: "",
            confirmedRound: 0,
            contractAddress: "addr-3",
            logicSignature: "sig-1"
          }
          ]])
        },
        "net 0195": {
          timestamp: 195,
          metadata: new Map([["1241 key", "345 value"]]),
          asa: new Map<string, ASAInfo>(),
          asc: new Map<string, ASCInfo>()
        }
      });
      assert.deepEqual(cpData.strippedCP, {
        network1: {
          timestamp: 1111,

          metadata: new Map([["key 1", "data 1"],
            ["metadata key", "metadata value"]]),
          asa: new Map([["ASA name", {
            creator: "ASA creator 123",
            txId: "",
            assetIndex: 0,
            confirmedRound: 0
          }]]),
          asc: new Map([["ASC name", {
            creator: "ASC creator 951",
            txId: "",
            confirmedRound: 0,
            contractAddress: "addr-3",
            logicSignature: "sig-1"
          }]])
        },
        "net 0195": {
          timestamp: 195,
          metadata: new Map([["1241 key", "345 value"]]),
          asa: new Map<string, ASAInfo>(),
          asc: new Map<string, ASCInfo>()
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
    cpData.registerASA("network1", "ASA name", {
      creator: "ASA creator 123",
      txId: "",
      assetIndex: 0,
      confirmedRound: 0
    })
      .registerASC("network1", "ASC name", {
        creator: "ASC creator 951",
        txId: "",
        confirmedRound: 0,
        contractAddress: "addr-3",
        logicSignature: "sig-1"
      });
    assert.isTrue(cpData.isDefined("network1", "ASA name"));
    assert.isTrue(cpData.isDefined("network1", "ASC name"));
    assert.isFalse(cpData.isDefined("network1", "other name"));
    assert.isFalse(cpData.isDefined("other network", "ASA name"));
    assert.isFalse(cpData.isDefined("other network", "ASC name"));
  });
});

//  LocalWords:  cp
