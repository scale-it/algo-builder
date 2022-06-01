import { types } from "@algo-builder/web";
import { expect } from "chai";

import { AccountStore, Runtime, types as rtypes } from "../../src/index";
import { useFixture } from "../helpers/integration";

describe("TEALv5: Pooled Opcode Cost calculation", function () {
	useFixture("basic-teal");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let appDefinition: types.AppDefinition;
	let appID: number;
	let appCallParam: types.AppCallsParam;
	this.beforeAll(function () {
		runtime = new Runtime([john]); // setup test
		approvalProgramFilename = "label-first-line.teal";
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

		appID = runtime.deployApp(john.account, appDefinition, {}).appID;

		appCallParam = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			appID: appID,
			payFlags: { totalFee: 1000 },
		};
	});

	it("Gas should be number", function () {
		const receipt = runtime.executeTx([appCallParam])[0] as rtypes.AppInfo;
		expect(receipt.gas).to.equal(99);
	});
});
