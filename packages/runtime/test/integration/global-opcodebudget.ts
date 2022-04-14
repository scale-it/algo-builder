import { parsing, types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore, getProgram, Runtime } from "../../src/index";
import { LogicSigAccount } from "../../src/logicsig";
import { AppDeploymentFlags } from "../../src/types";
import { useFixture } from "../helpers/integration";


function decodeNum(num: bigint): string {
	return new TextDecoder().decode(parsing.uint64ToBigEndian(num));
}

describe("TEALv6: Global Opcode Budget", function () {
	useFixture("global-opcodebudget");
	const john = new AccountStore(10e6);

	let runtime: Runtime;
	let flags: AppDeploymentFlags;
	let appID: number;
	let dummyAppID: number;
	let txnParam: types.ExecParams;
	let lsig: LogicSigAccount;
	this.beforeAll(async function () {
		runtime = new Runtime([john]); // setup test

		flags = {
			sender: john.account,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};

		appID = runtime.deployApp("app.teal", "clear.teal", flags, {}).appID;

		dummyAppID = runtime.deployApp("dummy-app.teal", "clear.teal", flags, {}).appID;

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
			assert.deepEqual(
				receipts[0].logs?.at(0),
				decodeNum(693n)
			);
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
			};
			const receipts = runtime.executeTx([txnParam, buffTx]);
			assert.deepEqual(
				receipts[0].logs?.at(0),
				decodeNum(1393n)
			);
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
			assert.deepEqual(
				receipts[0].logs?.at(0),
				decodeNum(1396n)
			);
		});
	});
});
