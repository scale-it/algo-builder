import { ERRORS } from "@algo-builder/web";
import { assert } from "chai";

import { TASK_TEST } from "../../../src/builtin-tasks/task-names";
import { loadFilenames } from "../../../src/internal/util/files";
import { expectBuilderError } from "../../helpers/errors";
import { useCleanFixtureProject } from "../../helpers/project";

describe("loadFilenames", () => {
	useCleanFixtureProject("typescript-project");
	it("Should load ts and js files from test folder", function () {
		const ls = loadFilenames("test");
		const expected = ["test/js-test.js", "test/ts-test.ts"];
		assert.deepEqual(ls, expected);
	});

	it('Should throw error if dir name is not "test"', function () {
		expectBuilderError(
			() => loadFilenames("tests", TASK_TEST), // as dir should be "test"
			ERRORS.BUILTIN_TASKS.TESTS_DIRECTORY_NOT_FOUND
		);
	});
});
