import { assert } from "chai";

import { resetBuilderContext } from "../../src/internal/reset";
import { defaultNetCfg, useEnvironment } from "./environment";
import { useFixtureProject } from "./project";

describe("Builder lib", () => {
  useFixtureProject("config-project");
  useEnvironment();

  it("should load environment", function () {
    assert.isDefined(this.env.config.networks.custom);
  });

  it("should load user defined task", async function () {
    assert.isDefined(this.env.tasks.example2);
    assert.equal(await this.env.run("example2"), 28);
  });

  it("should reuse global state", async function () {
    /* eslint-disable @typescript-eslint/no-var-requires */
    let environment = await require("./environment").getEnv(defaultNetCfg);
    assert.isTrue(this.env === environment);

    resetBuilderContext();

    environment = await require("./environment").getEnv(defaultNetCfg);
    assert.equal(await environment.run("example"), 28);
    assert.isFalse(this.env === environment);
  });
});
