import { types } from "@algo-builder/web";
import { assert } from "chai";

import { getProgram } from "../../src";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("TEALv4: Knowable creatable ID", function () {
	useFixture("knowable-id");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgram: string;
	let approvalProgramPass: string;
	let approvalProgramFail: string;
	let clearProgram: string;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test
		approvalProgram = getProgram("approval.teal");
		approvalProgramPass = getProgram("approval-pass.teal");
		approvalProgramFail = getProgram("approval-fail.teal");
		clearProgram = getProgram("clear.teal");
	});

	it("should store correct asset/App ID", function () {
		const txGroup: types.ExecParams[] = [
			{
				type: types.TransactionType.DeployASA,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				asaName: "gold",
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: {
					appName: "firstApp",
					metaType: types.MetaType.SOURCE_CODE,
					approvalProgramCode: approvalProgram,
					clearProgramCode: clearProgram,
					localInts: 1,
					localBytes: 1,
					globalInts: 1,
					globalBytes: 1,
				},
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: {
					appName: "secondApp",
					metaType: types.MetaType.SOURCE_CODE,
					approvalProgramCode: approvalProgramPass,
					clearProgramCode: clearProgram,
					localInts: 1,
					localBytes: 1,
					globalInts: 2,
					globalBytes: 1,
				},
				payFlags: { totalFee: 1000 },
			},
		];
		runtime.executeTx(txGroup);
		const appInfoFirst = runtime.getAppInfoFromName(approvalProgram, clearProgram);
		const appInfoSecond = runtime.getAppInfoFromName(approvalProgramPass, clearProgram);
		const assetInfo = runtime.getAssetInfoFromName("gold");

		let result = runtime.getGlobalState(appInfoFirst?.appID as number, "first");
		assert.equal(result, BigInt(assetInfo?.assetIndex as number));

		result = runtime.getGlobalState(appInfoSecond?.appID as number, "second");
		assert.equal(result, BigInt(appInfoFirst?.appID as number));
	});

	it("should fail if program tries to access non existent transaction", function () {
		const txGroup: types.ExecParams[] = [
			{
				type: types.TransactionType.DeployASA,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				asaName: "gold",
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: {
					appName: "app",
					metaType: types.MetaType.SOURCE_CODE,
					approvalProgramCode: approvalProgramFail,
					clearProgramCode: clearProgram,
					localInts: 1,
					localBytes: 1,
					globalInts: 1,
					globalBytes: 1,
				},
				payFlags: { totalFee: 1000 },
			},
		];
		expectRuntimeError(
			() => runtime.executeTx(txGroup),
			RUNTIME_ERRORS.TEAL.GROUP_INDEX_EXIST_ERROR
		);
	});
});
