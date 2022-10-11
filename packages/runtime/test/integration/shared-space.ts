import { types } from "@algo-builder/web";
import { assert } from "chai";

import { getProgram } from "../../src";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: shared space between contracts", function () {
	useFixture("shared-space");
	const john = new AccountStore(10e6);
	const alice = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgram1: string;
	let approvalProgram2: string;
	let approvalProgramFail1: string;
	let approvalProgramFail2: string;
	let clearProgram: string;
	let groupTx: types.DeployAppParam[];
	let firstAppDefinition: types.AppDefinitionFromSource;
	let secondAppDefinition: types.AppDefinitionFromSource;

	this.beforeAll(async function () {
		runtime = new Runtime([john, alice]); // setup test
		approvalProgram1 = getProgram("approval-program-1.teal");
		approvalProgram2 = getProgram("approval-program-2.teal");
		approvalProgramFail1 = getProgram("approval-program-1-fail.teal");
		approvalProgramFail2 = getProgram("approval-program-2-fail.teal");
		clearProgram = getProgram("clear.teal");

		firstAppDefinition = {
			appName: "firstApp",
			metaType: types.MetaType.SOURCE_CODE,
			approvalProgramCode: approvalProgram1,
			clearProgramCode: clearProgram,
			localInts: 1,
			localBytes: 1,
			globalInts: 1,
			globalBytes: 1,
		};

		secondAppDefinition = {
			appName: "SecondApp",
			metaType: types.MetaType.SOURCE_CODE,
			approvalProgramCode: approvalProgram2,
			clearProgramCode: clearProgram,
			localInts: 1,
			localBytes: 1,
			globalInts: 1,
			globalBytes: 1,
		};

		groupTx = [
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: firstAppDefinition,
				payFlags: { note: "first Tx" },
			},
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: secondAppDefinition,
				payFlags: { note: "second Tx" },
			},
		];
	});

	it("should pass during create application", function () {
		// this code will pass, because shared space values are retreived correctly
		assert.doesNotThrow(() => runtime.executeTx(groupTx));
	});

	it("should fail during create application if second program compares wrong values", function () {
		groupTx[0].appDefinition.appName = "app";
		groupTx[1].appDefinition = {
			...firstAppDefinition,
			approvalProgramCode: approvalProgramFail2,
		};
		expectRuntimeError(() => runtime.executeTx(groupTx), RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
	});

	it("should fail if scratch doesn't have values for first application tx", function () {
		groupTx[0].appDefinition = {
			...firstAppDefinition,
			approvalProgramCode: approvalProgramFail1,
			appName: "app1",
		};
		groupTx[1].appDefinition = {
			...secondAppDefinition,
			approvalProgramCode: approvalProgram2,
			appName: "app2",
		};

		expectRuntimeError(() => runtime.executeTx(groupTx), RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
	});

	it("should fail if given transaction is not application tx", function () {
		const tx: types.ExecParams[] = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				toAccountAddr: alice.address,
				amountMicroAlgos: 100,
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: {
					...firstAppDefinition,
					approvalProgramCode: approvalProgram2,
				},
				payFlags: {},
			},
		];

		expectRuntimeError(() => runtime.executeTx(tx), RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR);
	});
});
