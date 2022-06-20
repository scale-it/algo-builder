import { types } from "@algo-builder/web";
import { assert } from "chai";

import { Runtime } from "../../src";
import RUNTIME_ERRORS from "../../src/errors/errors-list";
import { AccountStoreI, AppInfo } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

describe("Group inner transaction", function () {
	useFixture("group-inner-transaction");

	let runtime: Runtime;
	let appInfo: AppInfo;
	let alice: AccountStoreI;
	let contractAcc: AccountStoreI;

	function syncAccounts(): void {
		contractAcc = runtime.getAccount(appInfo.applicationAccount);
		[alice] = runtime.defaultAccounts();
	}
	this.beforeEach(() => {
		runtime = new Runtime([]);
		[alice] = runtime.defaultAccounts();

		appInfo = runtime.deployApp(
			alice.account,
			{
				appName: "app",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "group.py",
				clearProgramFilename: "clear.teal",
				globalBytes: 1,
				globalInts: 1,
				localBytes: 1,
				localInts: 1,
			},
			{}
		);

		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: appInfo.applicationAccount,
			amountMicroAlgos: 1e6,
			payFlags: {
				totalFee: 1000,
			},
		};

		runtime.executeTx([txnParams]);
		syncAccounts();
	});

	it("Can use itxn_next for create group inner tx transaction", () => {
		const contractBalance = contractAcc.balance();
		const aliceBalance = alice.balance();

		const txnParams: types.ExecParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			appID: appInfo.appID,
			appArgs: ["str:call"],
			payFlags: {
				totalFee: 1000,
			},
		};
		assert.doesNotThrow(() => runtime.executeTx([txnParams]));

		syncAccounts();

		// receive 2000 micro Algo from contract and spend 1000 micro Algo to send transaction to network
		assert.equal(aliceBalance + 1000n, alice.balance());
		// spend 5000 micro Algo
		assert.equal(contractBalance, contractAcc.balance() + 5000n);
	});

	describe("Number inner transaction limitation", function () {
		let secondAppInfo: AppInfo;
		this.beforeEach(() => {
			secondAppInfo = runtime.deployApp(
				alice.account,
				{
					appName: "secondApp",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "limit-number-txn.py",
					clearProgramFilename: "clear.teal",
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1,
				},
				{}
			);

			const txnParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				toAccountAddr: secondAppInfo.applicationAccount,
				amountMicroAlgos: 1e6,
				payFlags: {
					totalFee: 1000,
				},
			};

			runtime.executeTx([txnParams]);
			syncAccounts();
		});

		it("Should fail when issue more than 256 inner txn", () => {
			const firstTxn: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: secondAppInfo.appID,
				appArgs: ["str:exec"],
				payFlags: {
					totalFee: 1000,
				},
			};
			const secondTxn: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: secondAppInfo.appID,
				appArgs: ["str:exec"],
				payFlags: {
					totalFee: 1000,
					note: "second",
				},
			};
			const thirdTxn: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: secondAppInfo.appID,
				appArgs: ["str:exec"],
				payFlags: {
					totalFee: 1000,
					note: "third",
				},
			};
			const fourthTxn: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: secondAppInfo.appID,
				appArgs: ["str:exec"],
				payFlags: {
					totalFee: 1000,
					note: "fourth",
				},
			};

			expectRuntimeError(
				() => runtime.executeTx([firstTxn, secondTxn, thirdTxn, fourthTxn]),
				RUNTIME_ERRORS.GENERAL.TOO_MANY_INNER_TXN
			);
		});
	});
});
