import { ERRORS } from "@algo-builder/web";
import { assert } from "chai";

import { TasksDSL } from "../../../../src/internal/core/tasks/dsl";
import { expectBuilderErrorAsync } from "../../../helpers/errors";

describe("TasksDSL", function () {
	let dsl: TasksDSL;
	beforeEach(function () {
		dsl = new TasksDSL();
	});
	const action = Promise.resolve; // empty promise

	it("should add a task", function () {
		const taskName = "compile";
		const description = "compiler task description";

		const task = dsl.task(taskName, description, action);

		assert.equal(task.name, taskName);
		assert.equal(task.description, description);
		assert.equal(task.action, action);
		assert.isFalse(task.isInternal);
	});

	it("should add an internal task", function () {
		const task = dsl.internalTask("compile", "compiler task description", action);
		assert.isTrue(task.isInternal);
	});

	it("should add a task without description", function () {
		const task = dsl.task("compile", action);
		assert.isUndefined(task.description);
		assert.equal(task.action, action);
	});

	it("should add a task with default action", async function () {
		const task = dsl.task("compile", "a description");
		assert.isDefined(task.description);
		assert.isDefined(task.action);

		const runSuperNop: any = () => Promise.resolve();
		runSuperNop.isDefined = false;

		await expectBuilderErrorAsync(
			async () => await task.action({}, {} as any, runSuperNop),
			ERRORS.TASK_DEFINITIONS.ACTION_NOT_SET
		);
	});

	it("should override task", function () {
		const builtin = dsl.task("compile", "built-in", action);
		let tasks = dsl.getTaskDefinitions();
		assert.equal(tasks.compile, builtin);

		const custom = dsl.task("compile", "custom", action);
		tasks = dsl.getTaskDefinitions();
		assert.equal(tasks.compile, custom);
	});

	it("should return added tasks", function () {
		const task = dsl.task("compile", "built-in");
		const tasks = dsl.getTaskDefinitions();
		assert.deepEqual(tasks, { compile: task });
	});
});
