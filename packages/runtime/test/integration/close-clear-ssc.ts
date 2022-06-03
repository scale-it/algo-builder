import { parsing, types } from "@algo-builder/web";
import { assert } from "chai";

import { SSC_VALUE_BYTES } from "../../build/lib/constants";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import {
	ALGORAND_ACCOUNT_MIN_BALANCE,
	APPLICATION_BASE_FEE,
	SSC_VALUE_UINT,
} from "../../src/lib/constants";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("ASC - CloseOut from Application and Clear State", function () {
	useFixture("stateful");
	const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 20 + 1000; // 1000 to cover fee
	let john = new AccountStore(minBalance + 1000);
	let alice = new AccountStore(minBalance + 1000);

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let closeOutParams: types.AppCallsParam;
	let appDefinition: types.AppDefinitionFromFile;

	this.beforeAll(async function () {
		approvalProgramFilename = "close-clear-ssc.teal";
		clearProgramFilename = "clear.teal";

		appDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			globalBytes: 2,
			globalInts: 2,
			localBytes: 3,
			localInts: 3,
		};

		closeOutParams = {
			type: types.TransactionType.CloseApp,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			appID: 11,
			payFlags: { totalFee: 1000 },
		};
	});

	this.beforeEach(() => {
		runtime = new Runtime([john, alice]); // setup test
	});
	const syncAccount = (): void => {
		john = runtime.getAccount(john.address);
		alice = runtime.getAccount(alice.address);
	};

	it("should fail during closeOut if app id is not defined", function () {
		expectRuntimeError(
			() => runtime.executeTx([closeOutParams]),
			RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
		);
	});

	it("should successfully closeOut from app and update state according to asc", function () {
		const appID = runtime.deployApp(john.account, appDefinition, {}).appID; // create app
		const initialJohnMinBalance = runtime.getAccount(john.address).minBalance;

		runtime.optInToApp(john.address, appID, {}, {}); // opt-in to app (set new local state)
		syncAccount();
		assert.equal(
			john.minBalance,
			initialJohnMinBalance +
				(APPLICATION_BASE_FEE + (SSC_VALUE_UINT * 3 + SSC_VALUE_BYTES * 3)) // optInToApp increase
		); // verify minimum balance raised after optIn

		runtime.executeTx([{ ...closeOutParams, appID: appID }]);
		syncAccount();
		// verify app is deleted from local state
		const localApp = john.getAppFromLocal(appID);
		assert.isUndefined(localApp);

		// verify app is NOT deleted from global state
		const globalApp = runtime.getApp(appID);
		assert.isDefined(globalApp);

		// since app is deleted from local, local state should be undefined
		const localVal = runtime.getLocalState(appID, john.address, "local-key");
		assert.isUndefined(localVal);

		// since app is not deleted from global, global state should be updated by smart contract
		const globalVal = runtime.getGlobalState(appID, "global-key");
		assert.deepEqual(globalVal, parsing.stringToBytes("global-val"));

		// minimum balance should decrease to initial balance after closing out
		assert.equal(john.minBalance, initialJohnMinBalance);
	});

	it("should throw error if user is not opted-in for closeOut call", function () {
		// create app
		const appID = runtime.deployApp(john.account, appDefinition, {}).appID;
		closeOutParams.appID = appID;

		expectRuntimeError(
			() => runtime.executeTx([closeOutParams]),
			RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND
		);
		syncAccount();
	});

	it("should not delete application on CloseOut call if logic is rejected", function () {
		const appID = runtime.deployApp(john.account, appDefinition, {}).appID;
		const initialJohnMinBalance = runtime.getAccount(john.address).minBalance;
		runtime.optInToApp(john.address, appID, {}, {}); // opt-in to app (set new local state)
		syncAccount();
		const minBalanceAfterOptIn = john.minBalance;
		assert.equal(
			minBalanceAfterOptIn,
			initialJohnMinBalance +
				(APPLICATION_BASE_FEE + (SSC_VALUE_UINT * 3 + SSC_VALUE_BYTES * 3)) // optInToApp increase
		); // verify minimum balance raised after optIn

		const invalidParams: types.AppCallsParam = {
			type: types.TransactionType.CloseApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account, // sending txn sender other than creator (john), so txn should be rejected
			appID: appID,
			payFlags: {},
		};

		expectRuntimeError(
			() => runtime.executeTx([invalidParams]),
			RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
		);

		// verify app is not deleted from account's local state (as tx is rejected)
		const res = john.getAppFromLocal(appID);
		assert.isDefined(res);
		// minimum balance should remain the same as closeOutSSC failed
		assert.notEqual(john.minBalance, initialJohnMinBalance);
		assert.equal(john.minBalance, minBalanceAfterOptIn);
	});

	// clearState call is different from closeOut call as in clear call, app is deleted from account
	// even if transaction fails
	it("should delete application on clearState call even if logic is rejected", function () {
		// create app
		const rejectClearProgramFileName = "rejectClear.teal";
		const appID = runtime.deployApp(
			john.account,
			{ ...appDefinition, clearProgramFilename: rejectClearProgramFileName },
			{}
		).appID;

		const initialJohnMinBalance = runtime.getAccount(john.address).minBalance;
		const clearAppParams: types.AppCallsParam = {
			type: types.TransactionType.ClearApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account, // sending txn sender other than creator (john), so txn should be rejected
			appID: appID,
			payFlags: {},
		};
		runtime.optInToApp(alice.address, appID, {}, {}); // opt-in to app (set new local state)
		syncAccount();

		// verify before tx execution that local state is present
		let res = alice.getAppFromLocal(appID);
		assert.isDefined(res);

		runtime.executeTx([clearAppParams]);

		syncAccount();
		// verify app is deleted from account's local state even if tx is rejected after execution
		res = alice.getAppFromLocal(appID);
		assert.isUndefined(res);

		// verify global state is not deleted
		assert.isDefined(runtime.getApp(appID));
		// minimum balance should decrease to initial balance after clearing local state
		assert.equal(john.minBalance, initialJohnMinBalance);
	});
});
