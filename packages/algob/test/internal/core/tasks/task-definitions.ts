import { ERRORS } from "@algo-builder/web";
import { assert } from "chai";

import * as types from "../../../../src/internal/core/params/argument-types";
import {
	OverriddenTaskDefinition,
	SimpleTaskDefinition,
} from "../../../../src/internal/core/tasks/task-definitions";
import { unsafeObjectKeys } from "../../../../src/internal/util/unsafe";
import {
	ParamDefinition,
	ParamDefinitionAny,
	RuntimeArgs,
	TaskDefinition,
} from "../../../../src/types";
import { expectBuilderError, expectBuilderErrorAsync } from "../../../helpers/errors";

function expectThrowParamAlreadyDefinedError(f: () => any): void {
	expectBuilderError(f, ERRORS.TASK_DEFINITIONS.PARAM_ALREADY_DEFINED);
}

function getLastPositionalParam(taskDefinition: TaskDefinition): ParamDefinitionAny {
	assert.isNotEmpty(taskDefinition.positionalParamDefinitions);
	return taskDefinition.positionalParamDefinitions[
		taskDefinition.positionalParamDefinitions.length - 1
	];
}

function assertParamDefinition(
	actual: ParamDefinition<any>,
	expected: Partial<ParamDefinition<any>>
): void {
	for (const key of unsafeObjectKeys(actual)) {
		if (expected[key] !== undefined) {
			assert.deepEqual(actual[key], expected[key]);
		}
	}
}

const runSuperNop: any = () => Promise.resolve();
runSuperNop.isDefined = false;

describe("SimpleTaskDefinition", function () {
	describe("construction", function () {
		let taskDefinition: SimpleTaskDefinition;

		before("init taskDefinition", function () {
			taskDefinition = new SimpleTaskDefinition("name", true);
		});

		it("gets the right name", function () {
			assert.equal(taskDefinition.name, "name");
		});

		it("gets the right isInternal flag", function () {
			assert.isTrue(taskDefinition.isInternal);
		});

		it("starts without any param defined", function () {
			assert.deepEqual(taskDefinition.paramDefinitions, {});
			assert.isEmpty(taskDefinition.positionalParamDefinitions);
		});

		it("starts without any description", function () {
			assert.isUndefined(taskDefinition.description);
		});

		it("starts with an action that throws", async function () {
			await expectBuilderErrorAsync(
				async () => await taskDefinition.action({}, {} as any, runSuperNop),
				ERRORS.TASK_DEFINITIONS.ACTION_NOT_SET
			);
		});
	});

	describe("setDescription", function () {
		it("Should change the description", function () {
			const taskDefinition = new SimpleTaskDefinition("name");
			assert.isUndefined(taskDefinition.description);

			taskDefinition.setDescription("A");
			assert.equal(taskDefinition.description, "A");

			taskDefinition.setDescription("B");
			assert.equal(taskDefinition.description, "B");
		});
	});

	describe("setAction", function () {
		it("Should change the action", async function () {
			const taskDefinition = new SimpleTaskDefinition("name");

			taskDefinition.setAction(async () => 1);
			let result = await taskDefinition.action({}, {} as any, runSuperNop);
			assert.equal(result, 1);

			const obj = {};
			taskDefinition.setAction(async () => obj);
			result = await taskDefinition.action({}, {} as any, runSuperNop);
			assert.equal(result, obj);
		});
	});

	describe("param definition rules", function () {
		let taskDefinition: SimpleTaskDefinition;

		beforeEach("init taskDefinition", function () {
			taskDefinition = new SimpleTaskDefinition("name", true);
		});

		describe("param name repetitions", function () {
			beforeEach("set param with name 'name'", function () {
				taskDefinition.addParam("name", "a description", "asd");
			});

			it("should throw if addParam repeats a param name", function () {
				expectThrowParamAlreadyDefinedError(() =>
					taskDefinition.addParam("name", "another desc")
				);
			});

			it("should throw if addOptionalParam repeats a param name", function () {
				expectThrowParamAlreadyDefinedError(() =>
					taskDefinition.addOptionalParam("name", "another desc")
				);
			});

			it("should throw if addFlag repeats a param name", function () {
				expectThrowParamAlreadyDefinedError(() =>
					taskDefinition.addFlag("name", "another desc")
				);
			});

			it("should throw if addPositionalParam repeats a param name", function () {
				expectThrowParamAlreadyDefinedError(() =>
					taskDefinition.addPositionalParam("name", "another desc")
				);
			});

			it("should throw if addOptionalPositionalParam repeats a param name", function () {
				expectThrowParamAlreadyDefinedError(() =>
					taskDefinition.addOptionalPositionalParam("name", "another desc")
				);
			});

			it("should throw if addVariadicPositionalParam repeats a param name", function () {
				expectThrowParamAlreadyDefinedError(() =>
					taskDefinition.addVariadicPositionalParam("name", "another desc")
				);
			});

			it("should throw if addOptionalVariadicPositionalParam repeats a param name", function () {
				expectThrowParamAlreadyDefinedError(() =>
					taskDefinition.addOptionalVariadicPositionalParam("name", "another desc")
				);
			});
		});

		describe("param name clashes with Builder's ones", function () {
			function testClashWith(name: string): void {
				expectBuilderError(
					() => taskDefinition.addParam(name),
					ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_ALGOB_PARAM
				);
				expectBuilderError(
					() => taskDefinition.addOptionalParam(name),
					ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_ALGOB_PARAM
				);
				expectBuilderError(
					() => taskDefinition.addFlag(name),
					ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_ALGOB_PARAM
				);
				expectBuilderError(
					() => taskDefinition.addPositionalParam(name),
					ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_ALGOB_PARAM
				);
				expectBuilderError(
					() => taskDefinition.addOptionalPositionalParam(name),
					ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_ALGOB_PARAM
				);
				expectBuilderError(
					() => taskDefinition.addVariadicPositionalParam(name),
					ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_ALGOB_PARAM
				);
				expectBuilderError(
					() => taskDefinition.addOptionalVariadicPositionalParam(name),
					ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_ALGOB_PARAM
				);
			}

			it("Should throw if a param clashes", function () {
				// This is constructed to force a type error here if a Builder arg is
				// added and not tested.
				const algobArgs: RuntimeArgs = {
					showStackTraces: true,
					network: "",
					version: false,
					help: false,
					verbose: false,
				};

				Object.keys(algobArgs).forEach((name) => testClashWith(name));
			});
		});

		describe("positional param rules", function () {
			describe("no mandatory positional param after an optional one", function () {
				beforeEach("add optional positional", function () {
					taskDefinition.addOptionalPositionalParam("asd");
				});

				it("throws when trying to add a new positional param", function () {
					expectBuilderError(
						() => taskDefinition.addPositionalParam("asd2"),
						ERRORS.TASK_DEFINITIONS.MANDATORY_PARAM_AFTER_OPTIONAL
					);
				});

				it("throws when trying to add a new variadic positional param", function () {
					expectBuilderError(
						() => taskDefinition.addVariadicPositionalParam("asd2"),
						ERRORS.TASK_DEFINITIONS.MANDATORY_PARAM_AFTER_OPTIONAL
					);
				});

				describe("should still accept non-positional ones", function () {
					it("should accept a common param", function () {
						taskDefinition.addParam("p");
						assert.notEqual(taskDefinition.paramDefinitions.p, undefined);
					});

					it("should accept an optional param", function () {
						taskDefinition.addOptionalParam("p");
						assert.notEqual(taskDefinition.paramDefinitions.p, undefined);
					});

					it("should accept a flag", function () {
						taskDefinition.addFlag("p");
						assert.notEqual(taskDefinition.paramDefinitions.p, undefined);
					});
				});
			});

			describe("accepts multiple optional params", function () {
				beforeEach("add optional positional", function () {
					taskDefinition.addOptionalPositionalParam("asd");
				});

				it("should accept an optional positional param", function () {
					taskDefinition.addOptionalPositionalParam("asd2");
					const last = getLastPositionalParam(taskDefinition);
					assert.equal(last.name, "asd2");
					assert.isTrue(last.isOptional);
				});

				it("should accept an optional variadic positional param", function () {
					taskDefinition.addOptionalVariadicPositionalParam("asd2");
					const last = getLastPositionalParam(taskDefinition);
					assert.equal(last.name, "asd2");
					assert.isTrue(last.isOptional);
					assert.isTrue(last.isVariadic);
				});
			});

			describe("no positional params after a variadic positional param", function () {
				beforeEach("add variadic param", function () {
					taskDefinition.addVariadicPositionalParam("asd");
				});

				it("should throw on adding a positional param", function () {
					expectBuilderError(
						() => taskDefinition.addPositionalParam("p"),
						ERRORS.TASK_DEFINITIONS.PARAM_AFTER_VARIADIC
					);
				});

				it("should throw on adding an optional positional param", function () {
					expectBuilderError(
						() => taskDefinition.addOptionalPositionalParam("p"),
						ERRORS.TASK_DEFINITIONS.PARAM_AFTER_VARIADIC
					);
				});

				it("should throw on adding another variadic param", function () {
					expectBuilderError(
						() => taskDefinition.addVariadicPositionalParam("p"),
						ERRORS.TASK_DEFINITIONS.PARAM_AFTER_VARIADIC
					);
				});

				it("should throw on adding an optional variadic param", function () {
					expectBuilderError(
						() => taskDefinition.addOptionalVariadicPositionalParam("p"),
						ERRORS.TASK_DEFINITIONS.PARAM_AFTER_VARIADIC
					);
				});

				// eslint-disable-next-line sonarjs/no-identical-functions
				describe("should still accept non-positional ones", function () {
					it("should accept a common param", function () {
						taskDefinition.addParam("p");
						assert.notEqual(taskDefinition.paramDefinitions.p, undefined);
					});

					it("should accept an optional param", function () {
						taskDefinition.addOptionalParam("p");
						assert.notEqual(taskDefinition.paramDefinitions.p, undefined);
					});

					it("should accept a flag", function () {
						taskDefinition.addFlag("p");
						assert.notEqual(taskDefinition.paramDefinitions.p, undefined);
					});
				});
			});
		});
	});

	describe("Setting params", function () {
		let taskDefinition: SimpleTaskDefinition;

		beforeEach("init taskDefinition", function () {
			taskDefinition = new SimpleTaskDefinition("name", true);
		});

		describe("addParam", function () {
			it("Should fail if the param name isn't camelCase", function () {
				expectBuilderError(
					() => taskDefinition.addParam("A"),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);

				expectBuilderError(
					() => taskDefinition.addParam("Aa"),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);

				expectBuilderError(
					() => taskDefinition.addParam("0"),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);

				expectBuilderError(
					() => taskDefinition.addParam("0a"),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);

				expectBuilderError(
					() => taskDefinition.addParam("a "),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);

				expectBuilderError(
					() => taskDefinition.addParam("a-1"),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);

				expectBuilderError(
					() => taskDefinition.addParam("a_"),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);

				expectBuilderError(
					() => taskDefinition.addParam("a_b"),
					ERRORS.TASK_DEFINITIONS.INVALID_PARAM_NAME_CASING
				);
			});

			it("should add the param correctly", function () {
				taskDefinition.addParam("p", "desc", 123, types.int, true);
				assertParamDefinition(taskDefinition.paramDefinitions.p, {
					name: "p",
					description: "desc",
					defaultValue: 123,
					type: types.int,
					isOptional: true,
					isVariadic: false,
					isFlag: false,
				});
			});

			it("should set isOptional if a default value is provided", function () {
				taskDefinition.addParam("p", "desc", 123, types.int);
				assertParamDefinition(taskDefinition.paramDefinitions.p, {
					defaultValue: 123,
					isOptional: true,
				});
			});

			it("should accept an optional parm with undefined as default vlaue", function () {
				taskDefinition.addParam("p", "desc", undefined, types.int, true);
				assertParamDefinition(taskDefinition.paramDefinitions.p, {
					defaultValue: undefined,
					isOptional: true,
				});
			});

			it("should use types.string as if non type is given", function () {
				taskDefinition.addParam("p");
				assert.equal(taskDefinition.paramDefinitions.p.type, types.string);
			});

			it("should throw if a non-string default value is given but its type isn't set", function () {
				expectBuilderError(
					() => taskDefinition.addParam("p", "desc", 123),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);
			});

			it("should throw if a default value is set to a mandatory param", function () {
				expectBuilderError(
					() => taskDefinition.addParam("p", "desc", 123, types.int, false),
					ERRORS.TASK_DEFINITIONS.DEFAULT_IN_MANDATORY_PARAM
				);
			});
		});

		describe("addOptionalParam", function () {
			it("should set the param correctly", function () {
				taskDefinition.addOptionalParam("p", "desc", 123, types.int);
				assertParamDefinition(taskDefinition.paramDefinitions.p, {
					name: "p",
					description: "desc",
					defaultValue: 123,
					type: types.int,
					isOptional: true,
					isVariadic: false,
					isFlag: false,
				});
			});

			it("should work with undefined as default value", function () {
				taskDefinition.addOptionalParam("p", "desc", undefined);
				assertParamDefinition(taskDefinition.paramDefinitions.p, {
					defaultValue: undefined,
					isOptional: true,
				});
			});

			it("should use types.string as if non type is given", function () {
				taskDefinition.addOptionalParam("p");
				assert.equal(taskDefinition.paramDefinitions.p.type, types.string);
			});

			it("should throw if a non-string default value is given but its type isn't set", function () {
				expectBuilderError(
					() => taskDefinition.addOptionalParam("p", "desc", 123),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);
			});
		});

		describe("addFlag", function () {
			it("should set an optional boolean param", function () {
				taskDefinition.addFlag("f", "d");

				assertParamDefinition(taskDefinition.paramDefinitions.f, {
					name: "f",
					description: "d",
					defaultValue: false,
					type: types.boolean,
					isOptional: true,
					isVariadic: false,
					isFlag: true,
				});
			});
		});

		describe("addPositionalParam", function () {
			it("shouldn't add the param definition to paramDefinitions", function () {
				taskDefinition.addPositionalParam("p", "desc");
				assert.isUndefined(taskDefinition.paramDefinitions.p);
			});

			it("should add the param definition to positionalParamDefinitions", function () {
				taskDefinition.addPositionalParam("p", "desc", 123, types.int, true);
				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					name: "p",
					description: "desc",
					defaultValue: 123,
					type: types.int,
					isOptional: true,
					isVariadic: false,
					isFlag: false,
				});
			});

			it("should work with undefined as default value", function () {
				taskDefinition.addPositionalParam("p", "desc", undefined, types.int, true);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: undefined,
					isOptional: true,
				});
			});

			it("should use types.string as if non type is given", function () {
				taskDefinition.addPositionalParam("p", "desc");
				const last = getLastPositionalParam(taskDefinition);
				assert.equal(last.type, types.string);
			});

			it("should throw if a non-string default value is given but its type isn't set", function () {
				expectBuilderError(
					() => taskDefinition.addPositionalParam("p", "desc", 123),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);
			});

			it("should throw if a default value is set to a mandatory param", function () {
				expectBuilderError(
					() => taskDefinition.addPositionalParam("p", "desc", 123, types.int, false),
					ERRORS.TASK_DEFINITIONS.DEFAULT_IN_MANDATORY_PARAM
				);
			});

			it("should set isOptional if default value is provided", function () {
				taskDefinition.addPositionalParam("p", "desc", "A");

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: "A",
					isOptional: true,
				});
			});
		});

		describe("addOptionalPositionalParam", function () {
			it("shouldn't add the param definition to paramDefinitions", function () {
				taskDefinition.addOptionalPositionalParam("p", "desc");
				assert.isUndefined(taskDefinition.paramDefinitions.p);
			});

			it("should add the param definition to positionalParamDefinitions", function () {
				taskDefinition.addOptionalPositionalParam("p", "desc", 123, types.int);
				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					name: "p",
					description: "desc",
					defaultValue: 123,
					type: types.int,
					isOptional: true,
					isVariadic: false,
					isFlag: false,
				});
			});

			it("should work with undefined as default value", function () {
				taskDefinition.addOptionalPositionalParam("p", "desc", undefined, types.int);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: undefined,
					isOptional: true,
				});
			});

			it("should use types.string as if non type is given", function () {
				taskDefinition.addOptionalPositionalParam("p", "desc");
				const last = getLastPositionalParam(taskDefinition);
				assert.equal(last.type, types.string);
			});

			it("should throw if a non-string default value is given but its type isn't set", function () {
				expectBuilderError(
					() => taskDefinition.addOptionalPositionalParam("p", "desc", 123),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);
			});
		});

		describe("addVariadicPositionalParam", function () {
			it("shouldn't add the param definition to paramDefinitions", function () {
				taskDefinition.addVariadicPositionalParam("p", "desc");
				assert.isUndefined(taskDefinition.paramDefinitions.p);
			});

			it("should add the param definition to positionalParamDefinitions", function () {
				taskDefinition.addVariadicPositionalParam("p", "desc", [123], types.int, true);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					name: "p",
					description: "desc",
					defaultValue: [123],
					type: types.int,
					isOptional: true,
					isVariadic: true,
					isFlag: false,
				});
			});

			it("should convert the default value into an array if necessary", function () {
				taskDefinition.addVariadicPositionalParam("p", "desc", 123, types.int, true);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: [123],
					isVariadic: true,
				});
			});

			it("should work with undefined as default value", function () {
				taskDefinition.addVariadicPositionalParam("p", "desc", undefined, types.int, true);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: undefined,
					isOptional: true,
					isVariadic: true,
				});
			});

			it("should use types.string as if non type is given", function () {
				taskDefinition.addVariadicPositionalParam("p", "desc");
				const last = getLastPositionalParam(taskDefinition);
				assert.equal(last.type, types.string);
			});

			it("should throw if a non-string default value is given but its type isn't set", function () {
				expectBuilderError(
					() => taskDefinition.addVariadicPositionalParam("p", "desc", 123),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);

				expectBuilderError(
					() => taskDefinition.addVariadicPositionalParam("p", "desc", [123]),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);
			});

			it("should throw if a default value is set to a mandatory param", function () {
				expectBuilderError(
					() => taskDefinition.addVariadicPositionalParam("p", "desc", 123, types.int, false),
					ERRORS.TASK_DEFINITIONS.DEFAULT_IN_MANDATORY_PARAM
				);

				expectBuilderError(
					() => taskDefinition.addVariadicPositionalParam("p", "desc", [123], types.int, false),
					ERRORS.TASK_DEFINITIONS.DEFAULT_IN_MANDATORY_PARAM
				);
			});

			it("should set isOptional if default value is provided", function () {
				taskDefinition.addVariadicPositionalParam("p", "desc", "A");

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: ["A"],
					isOptional: true,
					isVariadic: true,
				});
			});
		});

		describe("addOptionalVariadicPositionalParam", function () {
			it("shouldn't add the param definition to paramDefinitions", function () {
				taskDefinition.addOptionalVariadicPositionalParam("p", "desc");
				assert.isUndefined(taskDefinition.paramDefinitions.p);
			});

			it("should add the param definition to positionalParamDefinitions", function () {
				taskDefinition.addOptionalVariadicPositionalParam("p", "desc", [123], types.int);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					name: "p",
					description: "desc",
					defaultValue: [123],
					type: types.int,
					isOptional: true,
					isVariadic: true,
					isFlag: false,
				});
			});

			it("should convert the default value into an array if necessary", function () {
				taskDefinition.addOptionalVariadicPositionalParam("p", "desc", 123, types.int);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: [123],
					isVariadic: true,
				});
			});

			it("should work with undefined as default value", function () {
				taskDefinition.addOptionalVariadicPositionalParam("p", "desc", undefined, types.int);

				assertParamDefinition(getLastPositionalParam(taskDefinition), {
					defaultValue: undefined,
					isOptional: true,
					isVariadic: true,
				});
			});

			it("should use types.string as if non type is given", function () {
				taskDefinition.addOptionalVariadicPositionalParam("p", "desc");
				const last = getLastPositionalParam(taskDefinition);
				assert.equal(last.type, types.string);
			});

			it("should throw if a non-string default value is given but its type isn't set", function () {
				expectBuilderError(
					() => taskDefinition.addOptionalVariadicPositionalParam("p", "desc", 123),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);

				expectBuilderError(
					() => taskDefinition.addOptionalVariadicPositionalParam("p", "desc", [123]),
					ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE
				);
			});
		});
	});
});

describe("OverriddenTaskDefinition", function () {
	let parentTask: SimpleTaskDefinition;
	let overriddenTask: OverriddenTaskDefinition;

	beforeEach("init tasks", function () {
		parentTask = new SimpleTaskDefinition("t")
			.addParam("p", "desc")
			.addFlag("f")
			.addPositionalParam("pp", "positional param");

		overriddenTask = new OverriddenTaskDefinition(parentTask, true);
	});

	describe("construction", function () {
		it("should have the right name", function () {
			assert.equal(overriddenTask.name, "t");
		});

		it("should set isInternal", function () {
			assert.isTrue(overriddenTask.isInternal);
		});

		it("should set the parent task", function () {
			assert.equal(overriddenTask.parentTaskDefinition, parentTask);
		});
	});

	describe("inherited properties", function () {
		it("should return the parent's name", function () {
			assert.equal(overriddenTask.name, parentTask.name);
		});

		it("should return the parent's action", function () {
			assert.equal(overriddenTask.action, parentTask.action);
		});

		it("should return the parent's description", function () {
			assert.equal(
				overriddenTask.description,
				parentTask.description === undefined ? "" : parentTask.description
			);
		});

		it("should return the parent's param definitions", function () {
			assert.equal(overriddenTask.paramDefinitions, parentTask.paramDefinitions);
		});

		it("should return the parent's positional param definitions", function () {
			assert.equal(
				overriddenTask.positionalParamDefinitions,
				parentTask.positionalParamDefinitions
			);
		});

		it("should work with more than one level of chaining", function () {
			const overriddenAgain = new OverriddenTaskDefinition(overriddenTask, false);
			assert.equal(overriddenAgain.isInternal, false);
			assert.equal(overriddenAgain.name, parentTask.name);
			assert.equal(overriddenAgain.action, parentTask.action);
			assert.equal(
				overriddenAgain.description,
				parentTask.description === undefined ? "" : parentTask.description
			);
			assert.equal(overriddenAgain.paramDefinitions, parentTask.paramDefinitions);
			assert.equal(
				overriddenAgain.positionalParamDefinitions,
				parentTask.positionalParamDefinitions
			);
		});

		it("should return overridden actions", function () {
			assert.equal(overriddenTask.action, parentTask.action);

			const action2 = async (): Promise<any> => 1;
			overriddenTask.setAction(action2);

			assert.equal(overriddenTask.action, action2);

			const action3 = async (): Promise<any> => 1;
			overriddenTask.setAction(action3);

			assert.equal(overriddenTask.action, action3);

			const overriddenAgain = new OverriddenTaskDefinition(overriddenTask);
			assert.equal(overriddenAgain.action, action3);

			const action4 = async (): Promise<any> => 1;
			overriddenAgain.setAction(action4);

			assert.equal(overriddenTask.action, action3);
			assert.equal(overriddenAgain.action, action4);
		});

		it("should return overridden descriptions", function () {
			assert.equal(
				overriddenTask.description,
				parentTask.description === undefined ? "" : parentTask.description
			);

			overriddenTask.setDescription("d2");
			assert.equal(overriddenTask.description, "d2");

			overriddenTask.setDescription("d3");
			assert.equal(overriddenTask.description, "d3");

			const overriddenAgain = new OverriddenTaskDefinition(overriddenTask);
			assert.equal(overriddenTask.description, "d3");

			overriddenAgain.setDescription("d4");
			assert.equal(overriddenTask.description, "d3");
			assert.equal(overriddenAgain.description, "d4");
		});
	});

	describe("Param definitions can be added only in compatible cases", function () {
		it("should add a flag param if addFlag is called", function () {
			overriddenTask.addFlag("flagParam", "flag in overriden task");
			assertParamDefinition(overriddenTask.paramDefinitions.flagParam, {
				name: "flagParam",
				description: "flag in overriden task",
				defaultValue: false,
				type: types.boolean,
				isOptional: true,
				isVariadic: false,
				isFlag: true,
			});
		});

		it("should throw if adding a param of same name that was already defined in parent task", function () {
			const definedParamName = "f";
			// a param definition in an overridenTask is present in the parentTask ref as well
			assert.isDefined(overriddenTask.paramDefinitions[definedParamName]);
			assert.isDefined(parentTask.paramDefinitions[definedParamName]);

			// expect PARAM_ALREADY_DEFINED for add flag param
			expectBuilderError(
				() => overriddenTask.addFlag(definedParamName),
				ERRORS.TASK_DEFINITIONS.PARAM_ALREADY_DEFINED
			);

			// expect PARAM_ALREADY_DEFINED for add optional param using addParam method
			expectBuilderError(
				() => overriddenTask.addParam(definedParamName, undefined, undefined, undefined, true),
				ERRORS.TASK_DEFINITIONS.PARAM_ALREADY_DEFINED
			);

			// expect PARAM_ALREADY_DEFINED for add optional param using addParam method
			expectBuilderError(
				() =>
					overriddenTask.addOptionalParam(definedParamName, undefined, undefined, undefined),
				ERRORS.TASK_DEFINITIONS.PARAM_ALREADY_DEFINED
			);
		});

		it("should throw if addParam is called with isOptional = false", function () {
			expectBuilderError(
				() => overriddenTask.addParam("p"),
				ERRORS.TASK_DEFINITIONS.OVERRIDE_NO_MANDATORY_PARAMS
			);
		});

		it("should add an optional param if addParam is called with isOptional = true", function () {
			const optParamName = "optParam";
			assert.isUndefined(overriddenTask.paramDefinitions[optParamName], "");

			overriddenTask.addParam(optParamName, undefined, undefined, undefined, true);

			assert.isDefined(overriddenTask.paramDefinitions[optParamName]);
		});

		it("should add an optional param if addOptionalParam is called", function () {
			const optParamName = "optParam";
			assert.isUndefined(overriddenTask.paramDefinitions[optParamName], "");
			overriddenTask.addOptionalParam(optParamName);
			assert.isDefined(overriddenTask.paramDefinitions[optParamName]);
		});

		it("should throw if addPositionalParam is called", function () {
			expectBuilderError(
				() => overriddenTask.addPositionalParam("p"),
				ERRORS.TASK_DEFINITIONS.OVERRIDE_NO_POSITIONAL_PARAMS
			);
		});

		it("should throw if addOptionalPositionalParam is called", function () {
			expectBuilderError(
				() => overriddenTask.addOptionalPositionalParam("p"),
				ERRORS.TASK_DEFINITIONS.OVERRIDE_NO_POSITIONAL_PARAMS
			);
		});

		it("should throw if addVariadicPositionalParam is called", function () {
			expectBuilderError(
				() => overriddenTask.addVariadicPositionalParam("p"),
				ERRORS.TASK_DEFINITIONS.OVERRIDE_NO_VARIADIC_PARAMS
			);
		});

		it("should throw if addOptionalVariadicPositionalParam is called", function () {
			expectBuilderError(
				() => overriddenTask.addOptionalVariadicPositionalParam("p"),
				ERRORS.TASK_DEFINITIONS.OVERRIDE_NO_VARIADIC_PARAMS
			);
		});
	});
});
