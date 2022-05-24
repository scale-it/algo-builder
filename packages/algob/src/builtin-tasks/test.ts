import findupSync from "findup-sync";
import Mocha from "mocha";

import { task } from "../internal/core/config/config-env";
import { loadFilenames } from "../internal/util/files";
import { testsDirectory } from "../lib/script-checkpoints";
import type { TaskTestConfig } from "../types";
import { TASK_TEST } from "./task-names";

const TEST_DIR = "test";
async function runTests(config: TaskTestConfig): Promise<void> {
	try {
		const tsPath = findupSync("tsconfig.json", { cwd: process.cwd() });
		if (tsPath) {
			// run tests via ts-mocha, if project is in typescript
			process.env.TS_NODE_PROJECT = tsPath;
			require("ts-mocha");
		}
		// User pass testFiles to arguments so just run those files.
		// else we run test files in default(root) test dir.
		const testFiles =
			config.testFiles.length !== 0
				? config.testFiles
				: loadFilenames(testsDirectory, TEST_DIR);

		const mocha = new Mocha(config.mocha);
		// Adding test files to mocha object
		testFiles.forEach((file) => mocha.addFile(file));
		await new Promise<number>((resolve) => {
			mocha.run(resolve);
		});
	} catch (error) {
		if (error instanceof Error) {
			console.log(error.message);
		}
		console.error("An unexpected error occurred:", error);
	}
}

export default function (): void {
	task(TASK_TEST, "Run tests using mocha in project root")
		.addOptionalVariadicPositionalParam(
			"testFiles",
			"An optional list of file path(s) to test",
			[]
		)
		.setAction((config) => runTests(config));
}
