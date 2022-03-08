import { types } from "@algo-builder/web";
import { expect } from "chai";

import { AccountStore, Runtime, types as rtypes } from "../../src/index";
import { AppDeploymentFlags } from "../../src/types";
import { useFixture } from "../helpers/integration";

describe("TEALv5: Pooled Opcode Cost calculation", function () {
	useFixture("basic-teal");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgramFileName: string;
	let clearProgramFileName: string;
	let flags: AppDeploymentFlags;
	let appID: number;
	let appCallParam: types.AppCallsParam;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test
		approvalProgramFileName = "label-first-line.teal";
		clearProgramFileName = "clear.teal";

		flags = {
			sender: john.account,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};

		appID = runtime.deployApp(approvalProgramFileName, clearProgramFileName, flags, {}).appID;

		appCallParam = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			appID: appID,
			payFlags: { totalFee: 1000 },
		};
	});

	it("Gas should be number", function () {
		const receipt = runtime.executeTx(appCallParam) as rtypes.AppInfo;
		expect(receipt.gas).to.equal(98);
	});
});
