import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import RUNTIME_ERRORS from "../../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../../src/index";
import { AccountStoreI } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

function rekeyMessageError(spend: string, signer: string): string {
	return `Should have been authorized by ${spend} but was actually authorized by ${signer}`;
}

describe("Rekey transaction and inner transaction ", function () {
	useFixture("inner-transaction");
	const fee = 1000;
	const amount = 1000n;
	const minBalance = 1e9 + fee;
	let master: AccountStoreI;
	let alice: AccountStoreI;
	let bob: AccountStoreI;
	let appAccount: AccountStoreI; // application account

	let runtime: Runtime;
	let storageConfig: types.StorageConfig;
	let appID: number;
	let appCallParams: types.ExecParams;

	function syncAccounts(): void {
		appAccount = runtime.getAccount(getApplicationAddress(appID));
		master = runtime.getAccount(master.address);
		alice = runtime.getAccount(alice.address);
		bob = runtime.getAccount(bob.address);
	}

	this.beforeEach(function () {
		// initial account and runtime
		master = new AccountStore(minBalance);
		alice = new AccountStore(minBalance);
		bob = new AccountStore(minBalance);
		runtime = new Runtime([master, alice, bob]);

		storageConfig = {
			appName: "app",
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};
	});

	describe("Apply Inner transaction when rekey application to account", function () {
		this.beforeEach(() => {
			// deploy application
			const approvalProgramFilename = "approval-rekey.teal";
			const clearProgramFilename = "clear-rekey.teal";
			appID = runtime.deployApp(
				master.account,
				{
					metaType: types.MetaType.FILE,
					approvalProgramFilename,
					clearProgramFilename,
					...storageConfig,
				},
				{}
			).appID;

			syncAccounts();
			// query appAccount
			appAccount = runtime.getAccount(getApplicationAddress(appID));

			// fund app (escrow belonging to app) with 1 ALGO
			const fundAppParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: master.account,
				toAccountAddr: getApplicationAddress(appID),
				amountMicroAlgos: 10e6,
				payFlags: { totalFee: 1000 },
			};

			runtime.executeTx([fundAppParams]);
			syncAccounts();

			// rekey to bob account
			appCallParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				appID: appID,
				payFlags: { totalFee: 1000 },
			};

			const paymentTxParams = {
				...appCallParams,
				accounts: [alice.address],
			};
			runtime.executeTx([paymentTxParams]);
			syncAccounts();
		});

		it("should rekey to another account address", function () {
			assert.equal(appAccount.getSpendAddress(), alice.address);
		});

		it("account should have permission transfer asset of application(ALGO transfer)", () => {
			const applBalanceBefore = appAccount.amount;
			const aliceBalanceBefore = alice.amount;
			const bobBalanceBefore = bob.amount;

			const tranferAlgoTx: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				fromAccountAddr: appAccount.address,
				toAccountAddr: bob.address,
				amountMicroAlgos: amount,
				payFlags: {
					totalFee: fee,
				},
			};
			runtime.executeTx([tranferAlgoTx]);

			syncAccounts();
			const applBalanceAfter = appAccount.amount;
			const aliceBalanceAfter = alice.amount;
			const bobBalanceAfter = bob.amount;

			// alice account didn't change
			assert.equal(aliceBalanceBefore, aliceBalanceAfter);
			// include fee and amount used for inner transaction
			assert.equal(applBalanceBefore, applBalanceAfter + amount + BigInt(fee));
			// bob will receive `amount` microAlgos
			assert.equal(bobBalanceBefore + amount, bobBalanceAfter);
		});

		it("should throw an error if auth/spend account invalid", () => {
			const tranferAlgoTx: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: bob.account,
				fromAccountAddr: appAccount.address,
				toAccountAddr: bob.address,
				amountMicroAlgos: amount,
				payFlags: {
					totalFee: fee,
				},
			};
			// should fail
			expectRuntimeError(
				() => runtime.executeTx([tranferAlgoTx]),
				RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
				rekeyMessageError(appAccount.getSpendAddress(), bob.address)
			);
		});
	});

	describe("apply rekey account to application with rekey transaction", function () {
		let txnParams: types.ExecParams;

		this.beforeEach(() => {
			// deploy app
			const approvalProgramFilename = "rekey-approval-payment.py";
			const clearProgramFilename = "clear.teal";
			appID = runtime.deployApp(
				master.account,
				{
					metaType: types.MetaType.FILE,
					approvalProgramFilename,
					clearProgramFilename,
					...storageConfig,
				},
				{}
			).appID;
			// query application account
			appAccount = runtime.getAccount(getApplicationAddress(appID));

			// rekey account to application
			txnParams = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				toAccountAddr: alice.address,
				amountMicroAlgos: 0n,
				payFlags: {
					totalFee: 1000,
					rekeyTo: getApplicationAddress(appID),
				},
			};

			runtime.executeTx([txnParams]);
			syncAccounts();
		});

		it("check account after rekey", () => {
			assert.equal(alice.getSpendAddress(), getApplicationAddress(appID));
		});

		it("Should transfer algo by inner transaction", () => {
			const masterBalanceBefore = master.amount;
			const aliceBalanceBefore = alice.amount;
			const bobBalanceBefore = bob.amount;

			txnParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: master.account,
				appID: appID,
				accounts: [alice.address, bob.address],
				appArgs: ["str:transfer_algo", `int:${amount}`],
				payFlags: {
					totalFee: fee,
				},
			};

			runtime.executeTx([txnParams]);
			syncAccounts();

			const masterBalanceAfter = master.amount;
			const aliceBalanceAfter = alice.amount;
			const bobBalanceAfter = bob.amount;

			// fee for send transaction to network
			assert.equal(masterBalanceBefore, masterBalanceAfter + BigInt(fee));
			// include fee and amount use for inner transaction
			assert.equal(aliceBalanceBefore, aliceBalanceAfter + amount + BigInt(fee));
			// bob will receive `amount` microAlgos
			assert.equal(bobBalanceBefore + amount, bobBalanceAfter);
		});

		it("Should failed: contract can't transfer asset if account not rekey to contract", () => {
			// transfer ALGO from bob to alice by contract, but bob didn't rekey to contract.
			txnParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: master.account,
				appID: appID,
				accounts: [bob.address, alice.address],
				appArgs: ["str:transfer_algo", `int:${amount}`],
				payFlags: {
					totalFee: fee,
				},
			};

			// should failed
			expectRuntimeError(
				() => runtime.executeTx([txnParams]),
				RUNTIME_ERRORS.GENERAL.INVALID_AUTH_ACCOUNT,
				rekeyMessageError(bob.getSpendAddress(), getApplicationAddress(appID))
			);
		});
	});
});
