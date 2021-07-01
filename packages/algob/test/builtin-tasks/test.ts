import { assert } from "chai";
import path from "path";

import { TASK_TEST } from "../../build/builtin-tasks/task-names";
import { loadFilenames } from "../../src/builtin-tasks/deploy";
import { ERRORS } from "../../src/errors/errors-list";
import { expectBuilderError } from "../helpers/errors";
import { useCleanFixtureProject } from "../helpers/project";

describe("Test task", function () {
  useCleanFixtureProject("typescript-project");

  it("Should load ts and js files from test folder", function () {
    const ls = loadFilenames("test");
    const expected = ['test/js-test.js', 'test/ts-test.ts'];
    assert.deepEqual(ls, expected);
  });

  it("Should throw error if dir name is not \"test\"", function () {
    expectBuilderError(
      () => loadFilenames("tests", TASK_TEST), // as dir should be "test"
      ERRORS.BUILTIN_TASKS.TESTS_DIRECTORY_NOT_FOUND
    );
  });

  it("Should set path to tsconfig in typescript project before running mocha", async function () {
    assert.isUndefined(process.env.TS_NODE_PROJECT);

    // should be 'fixture-projects/typescript-project/tsconfig.json'
    const expectedTsConfigPath = path.join(process.cwd(), 'tsconfig.json');
    await this.env.run(TASK_TEST).then(() => {
      assert.deepEqual(process.env.TS_NODE_PROJECT, expectedTsConfigPath);
    });
  });
});
