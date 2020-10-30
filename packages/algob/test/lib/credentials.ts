import { assert } from "chai";

import { algodCredentialsFromEnv, KMDCredentialsFromEnv } from "../../src/lib/credentials";

describe("Credentials loading from env: ", () => {
  process.env.ALGOD_ADDR = "127.0.0.1:8080";
  process.env.ALGOD_TOKEN = "algod_token";

  it("Algod Credentials", () => {
    const result = algodCredentialsFromEnv();
    assert.deepEqual(result, { host: "127.0.0.1", port: 8080, token: "algod_token" });
  });

  it("Algod Credentials Missing", () => {
    delete process.env.ALGOD_ADDR;

    const errmsg = "Both Algod Token and Algod Address should be defined in env";
    assert.throws(() => algodCredentialsFromEnv(), errmsg);
  });

  process.env.KMD_ADDR = "127.0.0.1:3480";
  process.env.KMD_TOKEN = "kmd_token";

  it("KMD Credentials", () => {
    const result = KMDCredentialsFromEnv();
    assert.deepEqual(result, { host: "127.0.0.1", port: 3480, token: "kmd_token" });
  });

  it("KMD Credentials Missing", () => {
    delete process.env.KMD_TOKEN;

    const errmsg = "Both KMD Token and KMD Address should be defined in env";
    assert.throws(() => KMDCredentialsFromEnv(), errmsg);
  });
});
