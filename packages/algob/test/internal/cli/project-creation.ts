import { assert } from "chai";
import fs from "fs-extra";

import { ERRORS } from "../../../src";
import { createProject } from "../../../src/internal/cli/project-creation";
import { expectBuilderErrorAsync } from "../../helpers/errors";
import { useFixtureProject } from "../../helpers/project";

describe("Init project", () => {
	useFixtureProject("init-task");

	afterEach(() => {
		const paths = fs.readdirSync("./");
		for (const path of paths) {
			if (path !== "README.md") {
				fs.removeSync(path);
			}
		}
	});

	it("should init project in an empty folder(javascript) with infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, false, true);

		assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
		assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.js`));
		assert.isTrue(fs.existsSync(`./${location}/infrastructure`));
	});

	it("should init project in an empty folder(javascript) without infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, false, false);

		assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
		assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.js`));
		assert.isFalse(fs.existsSync(`./${location}/infrastructure`));
	});

	it("should init project in a empty folder(typescript) with infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, true, true);

		assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
		assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.ts`));
		assert.isTrue(fs.existsSync(`./${location}/tsconfig.json`));
		assert.isTrue(fs.existsSync(`./${location}/infrastructure/Makefile`));
	});

	it("should init project in a empty folder(typescript) without infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, true, false);

		assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
		assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.ts`));
		assert.isTrue(fs.existsSync(`./${location}/tsconfig.json`));
		assert.isFalse(fs.existsSync(`./${location}/infrastructure/Makefile`));
	});

	it("should not create project if folder already exist", async () => {
		await createProject("location", false, false);

		await expectBuilderErrorAsync(
			async () => await createProject("location", false, false),
			ERRORS.GENERAL.INIT_INSIDE_PROJECT
		);
	});

	it("should init project in an empty folder(typescript) with `.`", async () => {
		const location = ".";
		await createProject(location, true, false);

		assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
		assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.ts`));
	});

	it("should not init project if it already exists with `.`", async () => {
		await createProject(".", false, false);

		await expectBuilderErrorAsync(
			async () => await createProject(".", false, false),
			ERRORS.GENERAL.INIT_INSIDE_PROJECT
		);
	});
});
