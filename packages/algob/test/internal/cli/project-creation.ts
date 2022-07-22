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

	function checkPaths(
		location: string,
		isTs: boolean,
		withInfrastructure: boolean,
		isNpm: boolean
	) {
		assert.isTrue(fs.existsSync(`./${location}/algob.config.js`));
		if (isTs) {
			assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.ts`));
		} else {
			assert.isTrue(fs.existsSync(`./${location}/scripts/0-sampleScript.js`));
		}
		assert.equal(withInfrastructure, fs.existsSync(`./${location}/infrastructure`));
	}

	it("should init npm project in an empty folder(javascript) with infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, false, true, true);
		checkPaths(location, false, true, true);
	});

	it("should init npm project in an empty folder(javascript) without infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, false, false, true);
		checkPaths(location, false, false, true);
	});

	it("should init npm project in a empty folder(typescript) with infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, true, true, true);
		checkPaths(location, true, true, true);
	});

	it("should init npm project in a empty folder(typescript) without infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, true, false, true);
		checkPaths(location, true, false, true);
	});

	it("should init yarn project in a empty folder(typescript) without infrastructure folder", async () => {
		const location = "test-project";
		await createProject(location, true, false, false);
		checkPaths(location, true, false, true);
	});

	it("should not create an npm project if folder already exist", async () => {
		await createProject("location", false, false, true);

		await expectBuilderErrorAsync(
			async () => await createProject("location", false, false, true),
			ERRORS.GENERAL.INIT_INSIDE_PROJECT
		);
	});

	it("should init npm project in an empty folder(typescript) with `.`", async () => {
		const location = ".";
		await createProject(location, true, false, true);
		checkPaths(location, true, false, true);
	});

	it("should not init npm project if it already exists with `.`", async () => {
		await createProject(".", false, false, true);

		await expectBuilderErrorAsync(
			async () => await createProject(".", false, false, true),
			ERRORS.GENERAL.INIT_INSIDE_PROJECT
		);
	});
});
