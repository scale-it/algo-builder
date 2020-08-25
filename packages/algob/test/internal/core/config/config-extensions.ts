// extendConfig must be available
// extendConfig shouldn't let me modify th user config
// config extenders must run in order
// config extensions must be visible

import { assert } from "chai";

import { BuilderContext } from "../../../../src/internal/context";
import { resetBuilderContext } from "../../../../src/internal/reset";
import { useEnvironment } from "../../../helpers/environment";
import { useFixtureProject } from "../../../helpers/project";

describe("Config extensions", function () {
  describe("Valid extenders", function () {
    useFixtureProject("config-extensions");
    useEnvironment();

    it("Should expose the new values", function () {
      const config: any = this.env.config;
      assert.isDefined(config.values);
    });

    it("Should execute extenders in order", function () {
      const config: any = this.env.config;
      assert.deepEqual(config.values, [1, 2]);
    });
  });

  describe("Invalid extensions", function () {
    useFixtureProject("invalid-config-extension");

    beforeEach(function () {
      BuilderContext.createBuilderContext();
    });

    afterEach(function () {
      resetBuilderContext();
    });
  });
});
