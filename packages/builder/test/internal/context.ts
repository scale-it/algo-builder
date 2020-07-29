import { assert } from "chai";

import { BuilderContext } from "../../src/internal/context";
import { ERRORS } from "../../src/internal/core/errors-list";
import { resetBuilderContext } from "../../src/internal/reset";
import { useEnvironment } from "../helpers/environment";
import { expectBuilderError } from "../helpers/errors";
import { useFixtureProject } from "../helpers/project";

describe("Builder context", function () {
  describe("no context", () => {
    it("context is not defined", async function () {
      assert.isFalse(BuilderContext.isCreated());
    });

    it("should throw when context isn't created", async function () {
      expectBuilderError(
        () => BuilderContext.getBuilderContext(),
        ERRORS.GENERAL.CONTEXT_NOT_CREATED
      );
    });
  });

  describe("create context but no environment", function () {
    afterEach("reset context", function () {
      resetBuilderContext();
    });

    it("context is defined", async function () {
      BuilderContext.createBuilderContext();
      assert.isTrue(BuilderContext.isCreated());
    });

    it("context initialize properly", async function () {
      const ctx = BuilderContext.createBuilderContext();
      assert.isDefined(ctx.extendersManager);
      assert.isDefined(ctx.tasksDSL);
      assert.isUndefined(ctx.environment);
    });

    it("should throw when recreating builder context", async function () {
      BuilderContext.createBuilderContext();
      expectBuilderError(
        () => BuilderContext.createBuilderContext(),
        ERRORS.GENERAL.CONTEXT_ALREADY_CREATED
      );
    });

    it("should delete context", async function () {
      assert.isFalse(BuilderContext.isCreated());
      BuilderContext.createBuilderContext();
      assert.isTrue(BuilderContext.isCreated());
      BuilderContext.deleteBuilderContext();
      assert.isFalse(BuilderContext.isCreated());
    });

    it("should throw when BRE is not defined", async function () {
      const ctx = BuilderContext.createBuilderContext();
      expectBuilderError(
        () => ctx.getAlgobRuntimeEnv(),
        ERRORS.GENERAL.CONTEXT_BRE_NOT_DEFINED
      );
    });
  });

  describe("environment creates context", function () {
    useFixtureProject("config-project");
    useEnvironment();
    it("should create context and set BRE into context", async function () {
      assert.equal(
        BuilderContext.getBuilderContext().getAlgobRuntimeEnv(),
        this.env
      );
    });
    it("should throw when trying to set BRE", async function () {
      expectBuilderError(
        () =>
          BuilderContext.getBuilderContext().setAlgobRuntimeEnv(
            this.env
          ),
        ERRORS.GENERAL.CONTEXT_BRE_ALREADY_DEFINED
      );
    });
  });
});
