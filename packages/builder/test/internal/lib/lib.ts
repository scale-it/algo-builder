import { assert } from "chai";

import { resetBuilderContext } from "../../../src/internal/reset";
import { useEnvironment } from "../../helpers/environment";
import { useFixtureProject } from "../../helpers/project";

describe("Builder lib", () => {
  useFixtureProject("config-project");
  useEnvironment();

  it("should load environment", function () {
    assert.isDefined(this.env.config.networks.custom);
  });

  it("should load task user defined task", async function () {
    assert.isDefined(this.env.tasks.example2);
    assert.equal(await this.env.run("example2"), 28);
  });

  it("should reuse global state", async function () {
    let environment = require("../../../src/internal/lib/lib"); // eslint-disable-line @typescript-eslint/no-var-requires
    assert.isTrue(this.env === environment);

    resetBuilderContext();

    environment = require("../../../src/internal/lib/lib"); // eslint-disable-line @typescript-eslint/no-var-requires
    assert.equal(await environment.run("example"), 28);
    assert.isFalse(this.env === environment);
  });
});
