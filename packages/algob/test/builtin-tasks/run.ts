import { ERRORS } from "@algo-builder/web";
import { assert } from "chai";
import fs from "fs";

import { splitAfter } from "../../src/builtin-tasks/run";
// import * as fsExtra from "fs-extra";
import { TASK_DEPLOY, TASK_RUN } from "../../src/builtin-tasks/task-names";
import { loadCheckpoint } from "../../src/lib/script-checkpoints";
import { useEnvironment } from "../helpers/environment";
import { expectBuilderErrorAsync } from "../helpers/errors";
import {
	testFixtureOutputFile,
	useCleanFixtureProject,
	useFixtureProject,
} from "../helpers/project";

describe("Run task", function () {
	useFixtureProject("project-with-scripts");
	useEnvironment();

	it("Should fail if a script doesn't exist", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["./scripts/does-not-exist"],
				}),
			ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND,
			"./scripts/does-not-exist"
		);
	});

	it("Should run the scripts to completion", async function () {
		await this.env.run(TASK_RUN, {
			script: ["./scripts/async-script.js"],
		});
	});

	it("Should run the script without arguments", async function () {
		await this.env.run(TASK_RUN, {
			script: ["./scripts/async-script.js"],
		});
	});

	it("Should run the script with empty arguments", async function () {
		await this.env.run(TASK_RUN, {
			script: ["./scripts/async-script.js"],
			arg: ""
		});
	});

	it("Should run the script with arguments", async function () {
		await this.env.run(TASK_RUN, {
			script: ["./scripts/async-script.js"],
			arg: '{"name":"user"}'
		});
	});

	it("Should fail if a script is not passed as first element of script array", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["arg1", "./scripts/does-not-exist"],
				}),
			ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND,
			"arg1"
		);
	});

	it("Should fail if empty script array is passed", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: [],
				}),
			ERRORS.BUILTIN_TASKS.RUN_FILE_NOT_FOUND_WITH_SUGGESTION,
		);
	});

	it("Should throw error when a valid JSON string is not passed as argument in the script", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["./scripts/async-script.js"],
					arg: "{name: usersname}"
				}),
			ERRORS.BUILTIN_TASKS.RUN_ARGUMENT_INVALID
		);
	});

	/* TODO:MM compile before running the task
  it("Should compile before running", async function () {
	if (await fsExtra.pathExists("cache")) {
	  await fsExtra.remove("cache");
	}

	if (await fsExtra.pathExists("artifacts")) {
	  await fsExtra.remove("artifacts");
	}

	await this.env.run(TASK_RUN, {
	  scripts: ["./scripts/successful-script.js"],
	});

	const files = await fsExtra.readdir("artifacts");
	assert.deepEqual(files, ["A.json"]);

	await fsExtra.remove("artifacts");
  });

  it("Shouldn't compile if asked not to", async function () {
	if (await fsExtra.pathExists("cache")) {
	  await fsExtra.remove("cache");
	}

	if (await fsExtra.pathExists("artifacts")) {
	  await fsExtra.remove("artifacts");
	}

	await this.env.run(TASK_RUN, {
	  scripts: ["./scripts/successful-script.js"],
	});

	assert.isFalse(await fsExtra.pathExists("artifacts"));
  });
  */
});

describe("Run task + clean", function () {
	useCleanFixtureProject("scripts-dir");
	useEnvironment();

	it("Should allow to run single script", async function () {
		await this.env.run(TASK_RUN, {
			script: ["scripts/1.js"],
		});
		const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
		assert.equal(
			scriptOutput,
			`scripts directory: script 1 executed\n`
		);
	});

	it("Should fail if any nonexistent scripts are passed", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["scripts/doesnotexist.js"],
				}),
			ERRORS.BUILTIN_TASKS.RUN_FILES_NOT_FOUND,
			"scripts/doesnotexist.js"
		);
	});

	it("Should return the script's status code on failure", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["scripts/other-scripts/failing.js"]
				}),
			ERRORS.BUILTIN_TASKS.SCRIPT_EXECUTION_ERROR,
			"scripts/other-scripts/failing.js"
		);
	});

	it("Should allow to rerun successful scripts twice", async function () {
		await this.env.run(TASK_RUN, {
			script: ["scripts/1.js"]
		});
		await this.env.run(TASK_RUN, {
			script: ["scripts/1.js"]
		});
		const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
		assert.equal(
			scriptOutput,
			`scripts directory: script 1 executed
scripts directory: script 1 executed
`
		);
	});

	it("Should allow script rerun a deployed script", async function () {
		await this.env.run(TASK_DEPLOY, {
			fileNames: ["scripts/1.js"],
		});
		await this.env.run(TASK_RUN, {
			script: ["scripts/1.js"],
		});
		const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
		assert.equal(
			scriptOutput,
			`scripts directory: script 1 executed
scripts directory: script 1 executed
`
		);
	});

	it("Should not create a snapshot", async function () {
		await this.env.run(TASK_RUN, {
			script: ["scripts/2.js"],
		});
		assert.isFalse(fs.existsSync("artifacts/scripts/2.js"));
	});

	it("Should not allow scripts outside of scripts dir", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["1.js"],
				}),
			ERRORS.BUILTIN_TASKS.SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY,
			"1.js"
		);
	});

	it("Should not save metadata", async function () {
		await this.env.run(TASK_RUN, {
			script: ["scripts/1.js"],
		});
		const persistedSnapshot = loadCheckpoint("./scripts/1.js");
		assert.deepEqual(persistedSnapshot, {});
		const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
		assert.equal(
			scriptOutput,
			`scripts directory: script 1 executed
`
		);
	});

	it("Should crash on trying to edit metadata", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["scripts/other-scripts/put-metadata.js"],
				}),
			ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY,
			"addCheckpointKV"
		);
		const persistedSnapshot = loadCheckpoint("scripts/other-scripts/put-metadata.js");
		assert.deepEqual(persistedSnapshot, {});
		const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
		assert.equal(scriptOutput, "put metadata script\n");
	});

	it("Should crash on deployASA", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["scripts/other-scripts/deploy-asa.js"],
				}),
			ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY,
			"deployASA"
		);
		const persistedSnapshot = loadCheckpoint("scripts/other-scripts/deploy-asa.js");
		assert.deepEqual(persistedSnapshot, {});
		const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
		assert.equal(scriptOutput, "deployASA script\n");
	});

	it("Should crash on fundLsigByFile", async function () {
		await expectBuilderErrorAsync(
			async () =>
				await this.env.run(TASK_RUN, {
					script: ["scripts/other-scripts/deploy-asc.js"],
				}),
			ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY,
			"fundLsigByFile"
		);
		const persistedSnapshot = loadCheckpoint("scripts/other-scripts/deploy-asc.js");
		assert.deepEqual(persistedSnapshot, {});
		const scriptOutput = fs.readFileSync(testFixtureOutputFile).toString();
		assert.equal(scriptOutput, "fundLsigByFile script\n");
	});
});

describe("splitAfter", function () {
	it("Should split an array into tuple", async function () {
		const orig = ["a", "b", "c"];
		const out = splitAfter(orig, "b");
		assert.deepEqual([out, orig], [["a", "b"], ["c"]]);
	});

	it("Should return original array when no item is found", async function () {
		const orig = ["a", "b", "c"];
		const out = splitAfter(orig, "d");
		assert.deepEqual([out, orig], [["a", "b", "c"], []]);
	});
});
