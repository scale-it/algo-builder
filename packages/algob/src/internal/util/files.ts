import { BuilderError, ERRORS } from "@algo-builder/web";
import fs from "fs";
import glob from "glob";
import path from "path";

import { cmpStr } from "../../lib/comparators";

/**
 * Load .js, .ts files from /scripts (default) directory
 * @param directory directory to load files from
 * @param taskType task type (eg. test)
 * @returns array of paths as string eg. ['scripts/file1.js', 'scripts/file2.js', ..]
 */
export function loadFilenames(directory: string, taskType?: string): string[] {
	if (!fs.existsSync(directory)) {
		if (taskType === "test") {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.TESTS_DIRECTORY_NOT_FOUND, {
				directory,
			});
		} else {
			throw new BuilderError(ERRORS.BUILTIN_TASKS.SCRIPTS_DIRECTORY_NOT_FOUND, {
				directory,
			});
		}
	}
	if (taskType === "test") {
		return glob
			.sync(path.join(directory, "**/*.js"))
			.concat(glob.sync(path.join(directory, "**/*.ts")))
			.sort(cmpStr);
	} else {
		return glob
			.sync(path.join(directory, "*.js"))
			.concat(glob.sync(path.join(directory, "*.ts")))
			.sort(cmpStr);
	}
}
