import { parsing, types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { StackElem } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("Crowdfunding basic tests", function () {
	useFixture("stateful");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let appDefinition: types.AppDefinitionFromFile;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test
		approvalProgramFilename = "crowdfunding.teal";
		clearProgramFilename = "clear.teal";

		appDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			globalBytes: 32,
			globalInts: 32,
			localBytes: 8,
			localInts: 8,
		};
	});

	it("should fail during create application if 0 args are passed", function () {
		// create new app
		expectRuntimeError(
			() => runtime.deployApp(john.account, appDefinition, {}),
			RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
		);
	});

	it("should create application and update global state if correct args are passed", function () {
		const validAppDefinition: types.AppDefinition = Object.assign({}, appDefinition);

		// Get begin date to pass in
		const beginDate = new Date();
		beginDate.setSeconds(beginDate.getSeconds() + 2);

		// Get end date to pass in
		const endDate = new Date();
		endDate.setSeconds(endDate.getSeconds() + 12000);

		// Get fund close date to pass in
		const fundCloseDate = new Date();
		fundCloseDate.setSeconds(fundCloseDate.getSeconds() + 120000);

		const appArgs = [
			parsing.uint64ToBigEndian(beginDate.getTime()),
			parsing.uint64ToBigEndian(endDate.getTime()),
			parsing.uint64ToBigEndian(7000000),
			parsing.addressToPk(john.address),
			parsing.uint64ToBigEndian(fundCloseDate.getTime()),
		];

		const johnMinBalance = john.minBalance;
		const appID = runtime.deployApp(
			john.account,
			{ ...validAppDefinition, appArgs: appArgs },
			{}
		).appID;
		// verify sender's min balance increased after creating application
		assert.isAbove(runtime.getAccount(john.address).minBalance, johnMinBalance);

		const getGlobal = (key: string): StackElem | undefined =>
			runtime.getGlobalState(appID, key);
		const johnPk = parsing.addressToPk(john.address);

		// verify global state
		assert.isDefined(appID);
		assert.deepEqual(getGlobal("Creator"), johnPk);
		assert.deepEqual(getGlobal("StartDate"), BigInt(beginDate.getTime()));
		assert.deepEqual(getGlobal("EndDate"), BigInt(endDate.getTime()));
		assert.deepEqual(getGlobal("Goal"), 7000000n);
		assert.deepEqual(getGlobal("Receiver"), johnPk);
		assert.deepEqual(getGlobal("Total"), 0n);
	});
});
