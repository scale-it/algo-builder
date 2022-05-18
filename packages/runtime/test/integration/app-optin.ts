import { types } from "@algo-builder/web";
import { assert } from "chai";

import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";

describe("Algorand Smart Contracts - Stateful Counter example", function () {
	useFixture("stateful");
	const fee = 1000;
	const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + fee;
	const alice = new AccountStore(minBalance + fee);
	const john = new AccountStore(minBalance + fee);

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let appID: number;
	let appDefinition: types.AppDefinitionFromFile;

	this.beforeAll(function () {
		runtime = new Runtime([alice, john]); // setup test
		clearProgramFilename = "clear.teal";
		appDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};
	});

	const key = "counter";

	it("should opt-in to app successfully and update local state", function () {
		// deploy new app
		approvalProgramFilename = "accept-optin.teal";
		appID = runtime.deployApp(
			john.account,
			{ ...appDefinition, approvalProgramFilename },
			{}
		).appID;

		// opt-in (should be accepted)
		assert.doesNotThrow(() => runtime.optInToApp(john.address, appID, {}, {}));

		// verify local state after optin
		const localCounter = runtime.getAccount(john.address).getLocalState(appID, key); // get local value from john account
		assert.isDefined(localCounter); // there should be a value present in local state with key "counter"
		assert.equal(localCounter, 0n);
	});

	it("should reject opt-in to app", function () {
		// deploy new app
		approvalProgramFilename = "reject-optin.teal";
		appID = runtime.deployApp(
			john.account,
			{ ...appDefinition, approvalProgramFilename },
			{}
		).appID;

		// verify local state not present BEFORE optin
		assert.isUndefined(alice.appsLocalState.get(appID));

		// opt-in (should be rejected)
		assert.throws(
			() => runtime.optInToApp(alice.address, appID, {}, {}),
			"RUNTIME_ERR1007: Teal code rejected by logic"
		);

		// verify local state not present AFTER optin (as optin is rejected)
		assert.isUndefined(alice.appsLocalState.get(appID));
	});
});
