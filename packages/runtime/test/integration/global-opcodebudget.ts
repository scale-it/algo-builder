import { types } from "@algo-builder/web";
import algosdk, { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore, getProgram, Runtime } from "../../src/index";
import { LogicSigAccount } from "../../src/logicsig";
import { useFixture } from "../helpers/integration";

describe("TEALv6: Global Opcode Budget", function () {
	useFixture("global-opcodebudget");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let appDefinition: types.AppDefinition;
	let appID: number;
	let dummyAppID: number;
	let txnParam: types.ExecParams;
	let lsig: LogicSigAccount;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test

		appDefinition = {
			metaType: types.MetaType.FILE,
			appName: "app",
			approvalProgramFilename: "app.teal",
			clearProgramFilename: "clear.teal",
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};

		appID = runtime.deployApp(john.account, appDefinition, {}).appID;

		dummyAppID = runtime.deployApp(
			john.account,
			{ ...appDefinition, approvalProgramFilename: "dummy-app.teal" },
			{}
		).appID;

		lsig = runtime.createLsigAccount(getProgram("lsig.teal"), []);

		runtime.fundLsig(john.account, lsig.address(), 1e6);

		txnParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			toAccountAddr: getApplicationAddress(appID),
			amountMicroAlgos: 1e6,
			payFlags: {},
		};
		runtime.executeTx([txnParam]);
	});

	it("Should pass signature logic", function () {
		txnParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			lsig: lsig,
			fromAccountAddr: lsig.address(),
			toAccountAddr: john.address,
			amountMicroAlgos: 0n,
			payFlags: {
				totalFee: 1000,
			},
		};

		runtime.executeTx([txnParam]);
		assert.doesNotThrow(() => runtime.executeTx([txnParam]));
	});

	describe("Test on application", () => {
		it("call application with single tx", () => {
			txnParam = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appID,
				appArgs: ["str:normal_tx"],
				payFlags: {
					totalFee: 1000,
				},
			};

			const receipts = runtime.executeTx([txnParam]);
			const logs = receipts[0].logs ?? [];
			assert.deepEqual(algosdk.bytesToBigInt(logs[0]), 692n);
		});

		it("call application with group tx", () => {
			txnParam = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appID,
				appArgs: ["str:normal_tx"],
				payFlags: {
					totalFee: 1000,
				},
			};

			const buffTx = {
				...txnParam,
				payFlags: {
					totalFee: 1000,
					note: "salt",
				},
			};
			const receipts = runtime.executeTx([txnParam, buffTx]);
			const logs = receipts[0].logs ?? [];
			assert.deepEqual(algosdk.bytesToBigInt(logs[0]), 1392n);
		});

		it("call application with inside inner tx", () => {
			txnParam = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appID,
				appArgs: ["str:inner_tx", `int:1`],
				foreignApps: [dummyAppID],
				payFlags: {
					totalFee: 2000,
				},
			};

			const receipts = runtime.executeTx([txnParam]);
			const logs = receipts[0].logs ?? [];
			assert.deepEqual(algosdk.bytesToBigInt(logs[0]), 1376n);
		});
	});
});
