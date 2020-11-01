import { assert } from "chai";
import * as path from "path";

import { algodCredentialsFromEnv, KMDCredentialsFromEnv } from "../../src/lib/credentials";
import { getFixtureProjectPath, useFixtureProject } from "../helpers/project";

describe("Credentials loading from env: ", () => {
  useFixtureProject("algorand-node-data");
  process.env.ALGOD_ADDR = "127.0.0.1:8080";
  process.env.ALGOD_TOKEN = "algod_token";

  it("Algod Credentials Using Method 1", () => {
    const result = algodCredentialsFromEnv();
    assert.deepEqual(result, { host: "127.0.0.1", port: 8080, token: "algod_token" });
  });

  it("Algod Credentials Missing (Method 1)", () => {
    delete process.env.ALGOD_ADDR;

    const errmsg = "Both Algod Token and Algod Address should be defined in env";
    assert.throws(() => algodCredentialsFromEnv(), errmsg);
  });

  it("Algod Credentials Using Method 2", () => {
    delete process.env.ALGOD_TOKEN;
    process.env.$ALGORAND_DATA = path.join(getFixtureProjectPath("algorand-node-data"), "Node");

    const result = algodCredentialsFromEnv();
    assert.deepEqual(result, {
      host: "127.0.0.1",
      port: 8081,
      token: "algod_token_using_method2\n"
    });
  });

  it("Algod Credentials Missing (Method 2)", () => {
    delete process.env.$ALGORAND_DATA;

    const errmsg = "Either Algod Credentials or $ALGORAND_DATA should be defined in env";
    assert.throws(() => algodCredentialsFromEnv(), errmsg);
  });

  process.env.KMD_ADDR = "127.0.0.1:3480";
  process.env.KMD_TOKEN = "kmd_token";

  it("KMD Credentials Using Method 1", () => {
    const result = KMDCredentialsFromEnv();
    assert.deepEqual(result, { host: "127.0.0.1", port: 3480, token: "kmd_token" });
  });

  it("KMD Credentials Missing (Method 1)", () => {
    delete process.env.KMD_TOKEN;

    const errmsg = "Both KMD Token and KMD Address should be defined in env";
    assert.throws(() => KMDCredentialsFromEnv(), errmsg);
  });

  it("KMD Credentials Using Method 2", () => {
    delete process.env.KMD_ADDR;
    process.env.$KMD_DATA = path.join(getFixtureProjectPath("algorand-node-data"), "Node/kmd");

    const result = KMDCredentialsFromEnv();
    assert.deepEqual(result, {
      host: "127.0.0.1",
      port: 8082,
      token: "kmd_token_using_method2\n"
    });
  });

  it("KMD Credentials Missing (Method 2)", () => {
    delete process.env.$KMD_DATA;

    const errmsg = "Either KMD Credentials or $KMD_DATA should be defined in env";
    assert.throws(() => KMDCredentialsFromEnv(), errmsg);
  });
});
