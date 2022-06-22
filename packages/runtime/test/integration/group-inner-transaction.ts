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
	let alice: AccountStoreI;
	let contractAcc: AccountStoreI;

	let firstAppInfo: AppInfo;
	let secondAppInfo: AppInfo;

	function syncAccounts(appInfo: AppInfo): void {
		contractAcc = runtime.getAccount(appInfo.applicationAccount);
		[alice] = runtime.defaultAccounts();
	}

	function deployAppAndFund(
		approvalProgramFilename: string,
		clearProgramFilename: string
	): AppInfo {
		const appInfo = runtime.deployApp(
			alice.account,
			{
				appName: `${approvalProgramFilename}-${clearProgramFilename}`,
				metaType: types.MetaType.FILE,
				approvalProgramFilename,
				clearProgramFilename,
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
		syncAccounts(appInfo);

		return appInfo;
	}

	this.beforeEach(() => {
		runtime = new Runtime([]);
		[alice] = runtime.defaultAccounts();

		firstAppInfo = deployAppAndFund("group.py", "clear.teal");
	});

	it("Can use itxn_next for create group inner tx transaction", () => {
		const contractBalance = contractAcc.balance();
		const aliceBalance = alice.balance();

		const txnParams: types.ExecParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			appID: firstAppInfo.appID,
			appArgs: ["str:call"],
			payFlags: {
				totalFee: 1000,
			},
		};
		assert.doesNotThrow(() => runtime.executeTx([txnParams]));

		syncAccounts(firstAppInfo);

		// receive 2000 micro Algo from contract and spend 1000 micro Algo to send transaction to network
		assert.equal(aliceBalance + 1000n, alice.balance());
		// spend 5000 micro Algo
		assert.equal(contractBalance, contractAcc.balance() + 5000n);
	});

	describe("Number inner transaction limitation", function () {
		this.beforeEach(() => {
			secondAppInfo = deployAppAndFund("limit-number-txn.py", "clear.teal");
		});

		it("Should fail when issue more than 256 inner txn", () => {
			const firstTxn: types.ExecParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: secondAppInfo.appID,
				appArgs: ["str:exec"],
				payFlags: {},
			};

			const secondTxn: types.ExecParams = {
				...firstTxn,
				payFlags: {
					note: "second",
				},
			};
			const thirdTxn: types.ExecParams = {
				...firstTxn,
				payFlags: {
					note: "third",
				},
			};
			const fourthTxn: types.ExecParams = {
				...firstTxn,
				payFlags: {
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
