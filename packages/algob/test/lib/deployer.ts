import { assert } from "chai";

import { ERRORS } from "../../src/internal/core/errors-list";
import { AlgobDeployerImpl } from "../../src/lib/deployer";
import { CheckpointRepoImpl } from "../../src/lib/script-checkpoints";
import { Checkpoints } from "../../src/types";
import { expectBuilderError, expectBuilderErrorAsync } from "../helpers/errors";
import { mkAlgobEnv } from "../helpers/params";
import { cleanupMutableData } from "./script-checkpoints";

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
    cpData.merge(cp1, "12s");
    cpData.merge(cp2, "12s");
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
