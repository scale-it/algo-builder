import { assert } from "chai";
import path from "path";

import {
  TASK_CLEAN,
  TASK_CONSOLE,
  TASK_HELP,
  TASK_INIT,
  TASK_RUN,
  TASK_TEST_EXAMPLE,
  TASK_TEST_GET_TEST_FILES
} from "../../../../src/builtin-tasks/task-names";
import { BuilderContext } from "../../../../src/internal/context";
import { loadConfigAndTasks } from "../../../../src/internal/core/config/config-loading";
import { ERRORS } from "../../../../src/internal/core/errors-list";
import { resetBuilderContext } from "../../../../src/internal/reset";
import { assertAccountsEqual } from "../../../helpers/assert-methods";
import { useEnvironment } from "../../../helpers/environment";
import { expectBuilderError } from "../../../helpers/errors";
import {
  getFixtureProjectPath,
  useFixtureProject
} from "../../../helpers/project";
import { account1 } from "../../../mocks/account";

describe("config loading", function () {
  describe("default config path", function () {
    useFixtureProject("config-project");
    useEnvironment();

    it("should load the default config if none is given", function () {
      const a: any = this.env.config.networks;
      assert.isDefined(a.localhost);
      assertAccountsEqual(a.localhost.accounts, [account1]);
    });
  });

  describe("Config validation", function () {
    describe("When the config is invalid", function () {
      useFixtureProject("invalid-config");

      beforeEach(function () {
        BuilderContext.createBuilderContext();
      });

      afterEach(function () {
        resetBuilderContext();
      });

      it("Should throw the right error", function () {
        expectBuilderError(
          () => loadConfigAndTasks(),
          ERRORS.GENERAL.INVALID_CONFIG
        );
      });
    });
  });

  describe("custom config path", function () {
    useFixtureProject("custom-config-file");

    beforeEach(function () {
      BuilderContext.createBuilderContext();
    });

    afterEach(function () {
      resetBuilderContext();
    });

    it("should accept a relative path from the CWD", function () {
      const config = loadConfigAndTasks({ config: "config.js" });

      if (!config.paths) {
        assert.fail("Project was not loaded");
      }

      assert.equal(
        config.paths.configFile,
        path.normalize(path.join(process.cwd(), "config.js"))
      );
    });

    it("should accept an absolute path", function () {
      const fixtureDir = getFixtureProjectPath("custom-config-file");
      const config = loadConfigAndTasks({
        config: path.join(fixtureDir, "config.js")
      });

      if (!config.paths) {
        assert.fail("Project was not loaded");
      }

      assert.equal(
        config.paths.configFile,
        path.normalize(path.join(process.cwd(), "config.js"))
      );
    });
  });

  describe("Tasks loading", function () {
    useFixtureProject("config-project");
    useEnvironment();

    it("Should define the default tasks", function () {
      assert.containsAllKeys(this.env.tasks, [
        TASK_CLEAN,
        TASK_RUN,
        TASK_INIT,
        TASK_CONSOLE,
        TASK_HELP,
        TASK_TEST_GET_TEST_FILES,
        TASK_TEST_EXAMPLE
      ]);
    });

    it("Should load custom tasks", function () {
      assert.containsAllKeys(this.env.tasks, ["example"]);
    });
  });

  describe("Config env", function () {
    useFixtureProject("config-project");

    afterEach(function () {
      resetBuilderContext();
    });

    it("should remove everything from global state after loading", function () {
      const globalAsAny: any = global;

      BuilderContext.createBuilderContext();
      loadConfigAndTasks();

      assert.isUndefined(globalAsAny.internalTask);
      assert.isUndefined(globalAsAny.task);
      assert.isUndefined(globalAsAny.types);
      assert.isUndefined(globalAsAny.extendEnvironment);
      assert.isUndefined(globalAsAny.usePlugin);

      resetBuilderContext();

      BuilderContext.createBuilderContext();
      loadConfigAndTasks();

      assert.isUndefined(globalAsAny.internalTask);
      assert.isUndefined(globalAsAny.task);
      assert.isUndefined(globalAsAny.types);
      assert.isUndefined(globalAsAny.extendEnvironment);
      assert.isUndefined(globalAsAny.usePlugin);
      resetBuilderContext();
    });
  });

  describe("Config that imports the library", function () {
    useFixtureProject("config-imports-lib-project");

    beforeEach(function () {
      BuilderContext.createBuilderContext();
    });

    afterEach(function () {
      resetBuilderContext();
    });

    it("should accept a relative path from the CWD", function () {
      expectBuilderError(
        () => loadConfigAndTasks(),
        ERRORS.GENERAL.LIB_IMPORTED_FROM_THE_CONFIG
      );
    });
  });
});
