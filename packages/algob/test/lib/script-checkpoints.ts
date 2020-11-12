import type { LogicSig } from "algosdk";
import { assert } from "chai";
import * as fs from "fs";

import { ERRORS } from "../../src/internal/core/errors-list";
import {
  appendToCheckpoint,
  CheckpointImpl,
  CheckpointRepoImpl,
  loadCheckpoint,
  persistCheckpoint,
  toCheckpointFileName,
  toScriptFileName
} from "../../src/lib/script-checkpoints";
import { ASAInfo, Checkpoint, Checkpoints, LsigInfo, SSCInfo } from "../../src/types";
import { expectBuilderError } from "../helpers/errors";

export function cleanupMutableData (netCheckpoint: Checkpoint, n: number): Checkpoint {
  assert.isNotNull(netCheckpoint.timestamp);
  netCheckpoint.timestamp = n;
  return netCheckpoint;
}

function createNetwork (timestamp: number): Checkpoint {
  return {
    timestamp: timestamp,
    metadata: new Map<string, string>(),
    asa: new Map<string, ASAInfo>(),
    ssc: new Map<string, SSCInfo>(),
    dLsig: new Map<string, LsigInfo>()
  };
}

describe("Checkpoint", () => {
  it("Should create a network checkpoint", async () => {
    const beforeTimestamp = +new Date();
    const netCheckpoint: Checkpoint = new CheckpointImpl();
    const afterTimestamp = +new Date();
    assert.isAtLeast(netCheckpoint.timestamp, beforeTimestamp);
    assert.isAtMost(netCheckpoint.timestamp, afterTimestamp);
    netCheckpoint.timestamp = 12345;
    assert.deepEqual(netCheckpoint, createNetwork(12345));
  });

  it("Should append to a checkpoint map", async () => {
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(new CheckpointImpl(), 34251);
    const checkpoint = appendToCheckpoint(checkpoints, "network213", netCheckpoint);
    assert.deepEqual(checkpoint, { network213: createNetwork(34251) });
    const netCheckpoint2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 539);
    checkpoints = appendToCheckpoint(checkpoints, "network5352", netCheckpoint2);
    assert.deepEqual(checkpoints, {
      network213: createNetwork(34251),
      network5352: createNetwork(539)
    });
  });

  it("Should replace in checkpoint map", async () => {
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(new CheckpointImpl(), 34251);
    checkpoints = appendToCheckpoint(checkpoints, "network525", netCheckpoint);
    assert.deepEqual(checkpoints, {
      network525: createNetwork(34251)
    });
    const netCheckpoint2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 539);
    checkpoints = appendToCheckpoint(checkpoints, "network525", netCheckpoint2);
    assert.deepEqual(checkpoints, {
      network525: createNetwork(539)
    });
  });

  it("Should merge metadata maps", async () => {
    var checkpoints: Checkpoints = {};
    const netCheckpoint: Checkpoint = cleanupMutableData(
      new CheckpointImpl(new Map([["key", "data"],
        ["key3", "data3"]])), 34251);
    netCheckpoint.asa.set("asa1", {
      creator: "123",
      txId: "",
      assetIndex: 0,
      confirmedRound: 0
    });
    netCheckpoint.ssc.set("SSC1", {
      creator: "536",
      txId: "",
      confirmedRound: 0,
      appID: -1
    });
    netCheckpoint.dLsig.set("lsig", {
      creator: "536",
      contractAddress: "addr-3",
      lsig: {} as LogicSig
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
        ssc: new Map([["SSC1", {
          creator: "536",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }]]),
        dLsig: new Map([["lsig", {
          creator: "536",
          contractAddress: "addr-3",
          lsig: {} as LogicSig
        }]])
      }
    });
    const netCheckpoint2: Checkpoint =
      cleanupMutableData(
        new CheckpointImpl(new Map([["key", "updated data"],
          ["key2", "data2"]])),
        125154251);
    netCheckpoint2.asa.set(
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
        ssc: new Map([["SSC1", {
          creator: "536",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }]]),
        dLsig: new Map([["lsig", {
          creator: "536",
          contractAddress: "addr-3",
          lsig: {} as LogicSig
        }]])
      }
    });
  });

  it("Should crash if duplicate asa or SSC name is detected", async () => {
    const checkpoints: Checkpoints = {};
    const cp1: Checkpoint = cleanupMutableData(
      new CheckpointImpl(new Map([["key", "data"],
        ["key3", "data3"]])),
      34251);
    cp1.asa.set("asa1", {
      creator: "123",
      txId: "",
      assetIndex: 0,
      confirmedRound: 0
    });
    appendToCheckpoint(checkpoints, "network12345", cp1);
    const cp2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 53521);
    cp2.asa.set("asa1", {
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
  // add test
  it("Should crash if duplicate SSC name is detected", async () => {
    const checkpoints: Checkpoints = {};
    const cp1: Checkpoint = cleanupMutableData(
      new CheckpointImpl(new Map([["key", "data"],
        ["key3", "data3"]])), 34251);
    cp1.ssc.set("SSC1", {
      creator: "123",
      txId: "",
      confirmedRound: 0,
      appID: -1
    });
    appendToCheckpoint(checkpoints, "network12345", cp1);
    const cp2: Checkpoint = cleanupMutableData(new CheckpointImpl(), 53521);
    cp2.ssc.set("SSC1", {
      creator: "36506",
      txId: "",
      confirmedRound: 0,
      appID: -1
    });
    expectBuilderError(
      () => appendToCheckpoint(checkpoints, "network12345", cp2),
      ERRORS.BUILTIN_TASKS.CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION,
      "SSC1"
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
    assert.deepEqual(cp, createNetwork(12345));
    cp.asa.set(
      "My ASA",
      {
        creator: "ASA deployer address",
        txId: "",
        assetIndex: 0,
        confirmedRound: 0
      });
    cp.ssc.set(
      "My SSC",
      {
        creator: "SSC deployer address",
        txId: "",
        confirmedRound: 0,
        appID: -1
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
      ssc: new Map([["My SSC", {
        creator: "SSC deployer address",
        txId: "",
        confirmedRound: 0,
        appID: -1
      }]]),
      dLsig: new Map()
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
      hi: createNetwork(123)
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      },
      myNetworkName2: {
        timestamp: 201,
        metadata: new Map([["key2", "data2"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      }
    });
  });

  it("Should allow placing state; two networks", () => {
    const cpData = new CheckpointRepoImpl()
      .registerSSC("network1", "SSC name", {
        creator: "SSC creator 951",
        txId: "",
        confirmedRound: 0,
        appID: -1
      })
      .putMetadata("net 0195", "1241 key", "345 value");
    cpData.precedingCP.network1.timestamp = 123;
    cpData.precedingCP["net 0195"].timestamp = 123;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        timestamp: 123,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map([["SSC name", {
          creator: "SSC creator 951",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }]]),
        dLsig: new Map<string, LsigInfo>()
      },
      "net 0195": {
        timestamp: 123,
        metadata: new Map([["1241 key", "345 value"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      }
    });
  });

  it("Should merge checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      }
    };
    const cp2: Checkpoints = {
      network2: {
        timestamp: 2,
        metadata: new Map([["key 2", "data 2"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      },
      network2: {
        timestamp: 2,
        metadata: new Map([["key 2", "data 2"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      }
    });
  });

  it("Should deeply merge the checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      }
    });
  });

  it("Should deeply merge global checkpoints", async () => {
    const cp1: Checkpoints = {
      network1: {
        timestamp: 1,
        metadata: new Map([["key 1", "data 1"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map([["SSC key1", {
          creator: "SSC creator1",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }
        ]]),
        dLsig: new Map<string, LsigInfo>()
      }
    };
    const cp2: Checkpoints = {
      network1: createNetwork(2)
    };
    const cp3: Checkpoints = {
      network1: {
        timestamp: 8,
        metadata: new Map<string, string>(),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map([["SSC key", {
          creator: "SSC creator",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }
        ]]),
        dLsig: new Map<string, LsigInfo>()
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
        ssc: new Map([["SSC key", {
          creator: "SSC creator",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }],
        ["SSC key1", {
          creator: "SSC creator1",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }]]),
        dLsig: new Map<string, LsigInfo>()
      }
    });
    cpData.precedingCP.network1.timestamp = 124;
    assert.deepEqual(cpData.precedingCP, {
      network1: {
        asa: new Map<string, ASAInfo>(),
        ssc: new Map([["SSC key", {
          creator: "SSC creator",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }]]),
        dLsig: new Map<string, LsigInfo>(),
        metadata: new Map<string, string>(),
        timestamp: 124
      }
    });
    cpData.strippedCP.network1.timestamp = 124;
    assert.deepEqual(cpData.strippedCP, {
      network1: {
        asa: new Map<string, ASAInfo>(),
        ssc: new Map([["SSC key", {
          creator: "SSC creator",
          txId: "",
          confirmedRound: 0,
          appID: -1
        }]]),
        dLsig: new Map<string, LsigInfo>(),
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
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
      }
    };
    const cp2: Checkpoints = {
      network4: {
        timestamp: 4,
        metadata: new Map([["metadata 4 key", "metadata value"]]),
        asa: new Map<string, ASAInfo>(),
        ssc: new Map<string, SSCInfo>(),
        dLsig: new Map<string, LsigInfo>()
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
      .registerSSC("network1", "SSC name", {
        creator: "SSC creator 951",
        txId: "",
        confirmedRound: 0,
        appID: -1
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

    it("Should contain factory methods for ASA anc SSC asset registration", () => {
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
          ssc: new Map([["SSC name", {
            creator: "SSC creator 951",
            txId: "",
            confirmedRound: 0,
            appID: -1
          }
          ]]),
          dLsig: new Map<string, LsigInfo>()
        },
        network4: {
          timestamp: 4,
          metadata: new Map([["metadata 4 key", "metadata value"]]),
          asa: new Map<string, ASAInfo>(),
          ssc: new Map<string, SSCInfo>(),
          dLsig: new Map<string, LsigInfo>()
        },
        "net 0195": {
          timestamp: 195,
          metadata: new Map([["1241 key", "345 value"]]),
          asa: new Map<string, ASAInfo>(),
          ssc: new Map<string, SSCInfo>(),
          dLsig: new Map<string, LsigInfo>()
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
          ssc: new Map([["SSC name", {
            creator: "SSC creator 951",
            txId: "",
            confirmedRound: 0,
            appID: -1
          }
          ]]),
          dLsig: new Map()
        },
        "net 0195": {
          timestamp: 195,
          metadata: new Map([["1241 key", "345 value"]]),
          asa: new Map<string, ASAInfo>(),
          ssc: new Map<string, SSCInfo>(),
          dLsig: new Map<string, LsigInfo>()
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
          ssc: new Map([["SSC name", {
            creator: "SSC creator 951",
            txId: "",
            confirmedRound: 0,
            appID: -1
          }]]),
          dLsig: new Map()
        },
        "net 0195": {
          timestamp: 195,
          metadata: new Map([["1241 key", "345 value"]]),
          asa: new Map<string, ASAInfo>(),
          ssc: new Map<string, SSCInfo>(),
          dLsig: new Map<string, LsigInfo>()
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
    assert.isFalse(cpData.isDefined("network1", "SSC name"));
    cpData.registerASA("network1", "ASA name", {
      creator: "ASA creator 123",
      txId: "",
      assetIndex: 0,
      confirmedRound: 0
    })
      .registerSSC("network1", "SSC name", {
        creator: "SSC creator 951",
        txId: "",
        confirmedRound: 0,
        appID: -1
      });
    assert.isTrue(cpData.isDefined("network1", "ASA name"));
    assert.isTrue(cpData.isDefined("network1", "SSC name"));
    assert.isFalse(cpData.isDefined("network1", "other name"));
    assert.isFalse(cpData.isDefined("other network", "ASA name"));
    assert.isFalse(cpData.isDefined("other network", "SSC name"));
  });
});

//  LocalWords:  cp
