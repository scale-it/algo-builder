import { assert } from "chai";
import path from "path";

import { TASK_TEST } from "../../build/builtin-tasks/task-names";
import { useCleanFixtureProject } from "../helpers/project";

describe("Test task", function () {
	useCleanFixtureProject("typescript-project");

	it("Should set path to tsconfig in typescript project before running mocha", async function () {
		assert.isUndefined(process.env.TS_NODE_PROJECT);

		// should be 'fixture-projects/typescript-project/tsconfig.json'
		const expectedTsConfigPath = path.join(process.cwd(), "tsconfig.json");
		await this.env.run(TASK_TEST).then(() => {
			assert.deepEqual(process.env.TS_NODE_PROJECT, expectedTsConfigPath);
		});
	});
});
