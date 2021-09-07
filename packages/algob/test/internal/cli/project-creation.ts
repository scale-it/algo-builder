import { assert } from "chai";
import fs from "fs-extra";

import { ERRORS } from "../../../src";
import { createProject } from "../../../src/internal/cli/project-creation";
import { expectBuilderErrorAsync } from "../../helpers/errors";
import { useFixtureProject } from "../../helpers/project";

describe("Init project", () => {
  useFixtureProject('init-task');

  afterEach(() => {
    const paths = fs.readdirSync("./");
    for (const path of paths) {
      if (path !== "README.md") { fs.removeSync(path); }
    }
  });

  it("should init project in a empty folder(javascript)", async () => {
    const location = "test-project";
    await createProject(location, false);

    assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
    assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.js`));
  });

  it("should init project in a empty folder(typescript)", async () => {
    const location = "test-project";
    await createProject(location, true);

    assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
    assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.ts`));
  });

  it("should not create project if folder already exist", async () => {
    await createProject("location", false);

    await expectBuilderErrorAsync(
      async () => await createProject("location", false),
      ERRORS.GENERAL.INIT_INSIDE_PROJECT
    );
  });

  it("should init project in a empty folder(typescript) with `.`", async () => {
    const location = ".";
    await createProject(location, true);

    assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
    assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.ts`));
  });

  it("should not create project if folder already exist with `.`", async () => {
    await createProject(".", false);

    await expectBuilderErrorAsync(
      async () => await createProject(".", false),
      ERRORS.GENERAL.INIT_INSIDE_PROJECT
    );
  });
});
