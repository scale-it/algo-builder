import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Sub routine", function () {
	useFixture("sub-routine");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgramPassFileName: string;
	let approvalProgramFailFileName: string;
	let approvalProgramFail1FileName: string;
	let clearProgramFilename: string;
	let appDefinition: types.AppDefinitionFromFile;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test
		approvalProgramPassFileName = "approval-pass.teal";
		approvalProgramFailFileName = "approval-fail.teal";
		approvalProgramFail1FileName = "approval-fail-1.teal";
		clearProgramFilename = "clear.teal";

		appDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename: approvalProgramPassFileName,
			clearProgramFilename,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
			appArgs: ["int:5"],
		};
	});

	it("should pass during create application", function () {
		// this code will pass, because sub-routine is working
		assert.doesNotThrow(() => runtime.deployApp(john.account, appDefinition, {}));
	});

	it("should fail during create application", function () {
		// this fails because in last condition we check if over subroutine section was executed
		appDefinition.approvalProgramFilename = approvalProgramFailFileName;
		expectRuntimeError(
			() => runtime.deployApp(john.account, appDefinition, {}),
			RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
		);
	});

	it("should fail during create application", function () {
		// this fails because there is no callsub before retsub(therefore callstack is empty)
		appDefinition.approvalProgramFilename = approvalProgramFail1FileName;
		expectRuntimeError(
			() => runtime.deployApp(john.account, appDefinition, {}),
			RUNTIME_ERRORS.TEAL.CALL_STACK_EMPTY
		);
	});

	it("should calculate correct fibonacci number", () => {
		appDefinition.approvalProgramFilename = "fibonacci.teal";
		let appID = runtime.deployApp(john.account, appDefinition, {}).appID;

		// 5th fibonacci
		let result = runtime.getGlobalState(appID, "result");
		assert.equal(result, 5n);

		// 6th fibonacci
		appDefinition.appArgs = ["int:6"];
		appID = runtime.deployApp(john.account, appDefinition, {}).appID;
		result = runtime.getGlobalState(appID, "result");

		assert.equal(result, 8n);

		// 8th fibonacci
		appDefinition.appArgs = ["int:8"];
		appID = runtime.deployApp(john.account, appDefinition, {}).appID;
		result = runtime.getGlobalState(appID, "result");

		assert.equal(result, 21n);

		// 1st fibonacci
		appDefinition.appArgs = ["int:1"];
		appID = runtime.deployApp(john.account, appDefinition, {}).appID;
		result = runtime.getGlobalState(appID, "result");

		assert.equal(result, 1n);
	});

	it("should throw cost exceed error", () => {
		appDefinition.appArgs = ["int:9"];
		appDefinition.approvalProgramFilename = "fibonacci.teal";
		expectRuntimeError(
			() => runtime.deployApp(john.account, appDefinition, {}),
			RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED
		);
	});
});
